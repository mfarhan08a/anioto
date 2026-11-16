import { afterEach, expect, it, vi } from 'vitest';
import { clearAnimeCache, resolveAnime } from '../src/providers/animethemes';

const song = { title: 'Akane Sasu (instrumental)', artist: 'Aimer' };
const body = { songs: [{ id: 6688, title: 'Akane Sasu', artists: [{ name: 'Aimer' }], animethemes: [{ type: 'ED', anime: { id: 2033, name: 'Natsume Yuujinchou Go', slug: 'natsume_yuujinchou_go' } }] }] };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
afterEach(() => { clearAnimeCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('publishes a documented title before artwork and stops waiting after 1.5 seconds', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => String(url).includes('/song?')
    ? json(body) : new Promise<Response>(() => {}))); // Even a non-cooperative request cannot hold the UI open.
  const observed = vi.fn();
  const pending = resolveAnime(song, undefined, observed);
  await vi.advanceTimersByTimeAsync(0);
  expect(observed).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ title: 'Natsume Yuujinchou Go', matchKind: 'version' })]));
  let done = false;
  void pending.then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(1499);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await expect(pending).resolves.toMatchObject([{ title: 'Natsume Yuujinchou Go', type: 'ED' }]);
});

it('reuses successful metadata, isolates returned objects, and expires the cache after one hour', async () => {
  vi.useFakeTimers();
  const request = vi.fn(async (url: RequestInfo | URL) => json(String(url).includes('/song?') ? body : { anime: { resources: [] } }));
  vi.stubGlobal('fetch', request);
  const first = await resolveAnime(song);
  const calls = request.mock.calls.length;
  first[0]!.title = 'Caller mutation';
  await expect(resolveAnime(song)).resolves.toMatchObject([{ title: 'Natsume Yuujinchou Go' }]);
  expect(request).toHaveBeenCalledTimes(calls);
  await vi.advanceTimersByTimeAsync(3_600_001);
  await resolveAnime(song);
  expect(request.mock.calls.length).toBeGreaterThan(calls);
});

it('does not cache empty searches or failures, and honors cancellation even on a cache hit', async () => {
  const request = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json({ songs: [] }))
    .mockImplementation(async (url: RequestInfo | URL) => json(String(url).includes('/song?') ? body : { anime: { resources: [] } }));
  vi.stubGlobal('fetch', request);
  await expect(resolveAnime(song)).rejects.toThrow('unavailable');
  await expect(resolveAnime(song)).resolves.toEqual([]);
  await expect(resolveAnime(song)).resolves.toHaveLength(1);
  const calls = request.mock.calls.length;
  const controller = new AbortController(); controller.abort();
  await expect(resolveAnime(song, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).toHaveBeenCalledTimes(calls);
});
