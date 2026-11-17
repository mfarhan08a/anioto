const MAX_AUDIO_BYTES = 44 + 12 * 32_000 * 2;
const MONTHLY_LIMIT = 1_000;
const NETWORK_DAILY_LIMIT = 15;
const AUDD_URL = 'https://api.audd.io/';

const json = (value, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
});

async function readClip(request) {
  const reader = request.body?.getReader();
  if (!reader) return;
  const bytes = new Uint8Array(MAX_AUDIO_BYTES);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.length > bytes.length) {
        await reader.cancel();
        return;
      }
      bytes.set(value, size);
      size += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const view = new DataView(bytes.buffer);
  const tag = (offset) => view.getUint32(offset);
  const u16 = (offset) => view.getUint16(offset, true);
  const u32 = (offset) => view.getUint32(offset, true);
  if (size < 44 + 32_000 * 2 || size % 2 || tag(0) !== 0x52494646 || tag(8) !== 0x57415645 ||
    tag(12) !== 0x666d7420 || tag(36) !== 0x64617461 || u32(4) !== size - 8 || u32(16) !== 16 ||
    u16(20) !== 1 || u16(22) !== 1 || u32(24) !== 32_000 || u32(28) !== 64_000 ||
    u16(32) !== 2 || u16(34) !== 16 || u32(40) !== size - 44) return;
  return bytes.subarray(0, size);
}

async function networkKey(secret, day, address) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}/${address}`));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function songFrom(result) {
  if (typeof result?.title !== 'string' || typeof result.artist !== 'string') return;
  const title = result.title.trim().slice(0, 200);
  const artist = result.artist.trim().slice(0, 200);
  if (!title || !artist) return;
  const album = typeof result.album === 'string' ? result.album.trim().slice(0, 200) : '';
  return { title, artist, ...(album ? { album } : {}) };
}

async function recognize(request, env) {
  if (env.RECOGNITION_ENABLED !== 'true' || !env.AUDD_TOKEN || !env.QUOTA_SECRET) return json({ error: 'unavailable' }, 503);
  const address = request.headers.get('CF-Connecting-IP');
  if (!address) return json({ error: 'unavailable' }, 503);
  if (request.headers.get('Content-Type') !== 'audio/wav') return json({ error: 'unsupported_format' }, 415);
  const length = request.headers.get('Content-Length');
  if (length && Number(length) > MAX_AUDIO_BYTES) return json({ error: 'sample_too_large' }, 413);
  const clip = await readClip(request);
  if (!clip) return json({ error: 'invalid_sample' }, 400);
  if (request.signal.aborted) return json({ error: 'cancelled' }, 400);

  const day = new Date().toISOString().slice(0, 10);
  const network = await networkKey(env.QUOTA_SECRET, day, address);
  const quota = env.QUOTAS.get(env.QUOTAS.idFromName('production'));
  const decision = await quota.fetch('https://quota.internal/reserve', { method: 'POST', body: JSON.stringify({ network }) });
  if (decision.status === 429) return json({ error: 'quota_exhausted' }, 429);
  if (!decision.ok || request.signal.aborted) return json({ error: 'unavailable' }, 503);

  const form = new FormData();
  form.set('api_token', env.AUDD_TOKEN);
  form.set('file', new Blob([clip], { type: 'audio/wav' }), 'sample.wav');
  const response = await fetch(AUDD_URL, {
    method: 'POST', body: form, redirect: 'error',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(9_000)]),
  });
  if (!response.ok) return json({ error: 'upstream_unavailable' }, 502);
  const body = await response.json();
  if (body?.status !== 'success') return json({ error: 'upstream_unavailable' }, 502);
  if (body.result === null) return json(null);
  const song = songFrom(body.result);
  return song ? json(song) : json({ error: 'invalid_result' }, 502);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/v1/recognize') return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try { return await recognize(request, env); }
    catch { return json({ error: 'unavailable' }, 503); }
  },
};

export class RecognitionQuota {
  constructor(state) {
    this.storage = state.storage;
    this.sql = this.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS quotas (bucket TEXT PRIMARY KEY, expires TEXT NOT NULL, hits INTEGER NOT NULL)');
  }

  async fetch(request) {
    const { network } = await request.json();
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);
    const allowed = this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM quotas WHERE expires <= ?', day);
      const buckets = [[`month:${month}`, nextMonth, MONTHLY_LIMIT], [`network:${network}`, tomorrow, NETWORK_DAILY_LIMIT]];
      const limitReached = buckets.some(([key, , limit]) => (this.sql.exec('SELECT hits FROM quotas WHERE bucket = ?', key).toArray()[0]?.hits ?? 0) >= limit);
      if (limitReached) return false;
      for (const [key, expires] of buckets) this.sql.exec('INSERT INTO quotas VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1', key, expires);
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
}
