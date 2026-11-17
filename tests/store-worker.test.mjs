import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import worker, { RecognitionQuota } from '../server/worker.mjs';
import { encodeWav } from '../src/capture';

afterEach(() => vi.unstubAllGlobals());

function sample(body = encodeWav(new Float32Array(32_000 * 8), 32_000)) {
  return new Request('https://anioto.example/v1/recognize', {
    method: 'POST', headers: { 'Content-Type': 'audio/wav', 'CF-Connecting-IP': '192.0.2.1' }, body,
  });
}

it('validates audio and forwards only the WAV and provider credential', async () => {
  const reserve = vi.fn(async () => new Response(null, { status: 204 }));
  const upstream = vi.fn(async () => Response.json({ status: 'success', result: { title: 'Test', artist: 'Artist', album: 'Album', ignored: true } }));
  vi.stubGlobal('fetch', upstream);
  const env = { RECOGNITION_ENABLED: 'true', AUDD_TOKEN: 'test-token', QUOTA_SECRET: 'test-secret', QUOTAS: { idFromName: () => 'production', get: () => ({ fetch: reserve }) } };

  expect((await worker.fetch(sample('invalid WAV'), env)).status).toBe(400);
  expect(reserve).not.toHaveBeenCalled();
  const result = await worker.fetch(sample(), env);
  expect(await result.json()).toEqual({ title: 'Test', artist: 'Artist', album: 'Album' });
  expect(reserve).toHaveBeenCalledOnce();
  expect(reserve.mock.calls[0][1].body).not.toContain('192.0.2.1');
  const [url, init] = upstream.mock.calls[0];
  expect(url).toBe('https://api.audd.io/');
  expect([...init.body.keys()]).toEqual(['api_token', 'file']);
  expect(init.body.get('file').size).toBe(512_044);

  reserve.mockResolvedValueOnce(new Response(null, { status: 429 }));
  expect((await worker.fetch(sample(), env)).status).toBe(429);
  expect(upstream).toHaveBeenCalledOnce();
  expect((await worker.fetch(sample(), { ...env, RECOGNITION_ENABLED: 'false' })).status).toBe(503);
  expect(reserve).toHaveBeenCalledTimes(2);
});

it('enforces the per-network and global caps against SQLite', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const sql = { exec(statement, ...args) {
      const prepared = db.prepare(statement);
      if (statement.startsWith('SELECT')) return { toArray: () => prepared.all(...args) };
      prepared.run(...args);
    } };
    const quotas = new RecognitionQuota({ storage: { sql, transactionSync: fn => fn() } });
    const reserve = (network) => quotas.fetch(new Request('https://quota.internal/reserve', { method: 'POST', body: JSON.stringify({ network }) }));
    const codes = await Promise.all(Array.from({ length: 16 }, () => reserve('same-network').then(result => result.status)));
    expect(codes.filter(code => code === 204)).toHaveLength(15);
    expect(codes.filter(code => code === 429)).toHaveLength(1);
    const month = new Date().toISOString().slice(0, 7);
    db.prepare('UPDATE quotas SET hits = 999 WHERE bucket = ?').run(`month:${month}`);
    expect((await reserve('new-network')).status).toBe(204);
    expect((await reserve('another-network')).status).toBe(429);
  } finally {
    db.close();
  }
});
