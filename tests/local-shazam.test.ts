import { afterEach, describe, expect, it, vi } from 'vitest';
import { recognizeLocal } from '../src/providers/local-shazam';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('local Shazam helper adapter', () => {
  it('posts the captured WAV to loopback with the required marker and returns validated songs', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ songs: [{ title: 'Snow Sound', artist: 'Novelbright', album: 'Demo' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(recognizeLocal(new Blob(['wav bytes'], { type: 'audio/wav' }), new AbortController().signal))
      .resolves.toEqual([{ title: 'Snow Sound', artist: 'Novelbright', album: 'Demo' }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:18742/recognize');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.mode).toBe('cors');
    expect(init.headers).toEqual({ 'Content-Type': 'audio/wav', 'X-Anime-Song-Finder': '1' });
    expect(init.body).toBeInstanceOf(Blob);
  });

  it('accepts an exact empty songs array as no match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: [] })));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).resolves.toEqual([]);
  });

  it('submits SongRec to its own endpoint and explains a stale helper', async () => {
    const request = vi.fn(async (_url: string, _init: RequestInit) => json({ error: 'Not found.' }, 404));
    vi.stubGlobal('fetch', request);
    await expect(recognizeLocal(new Blob(), new AbortController().signal, 'songrec')).rejects.toThrow('Restart the local helper to load SongRec support.');
    expect(request.mock.calls[0]?.[0]).toBe('http://127.0.0.1:18742/recognize/songrec');
  });

  it('rejects malformed payloads and song fields instead of treating them as no match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: [{ title: 'Song', artist: '' }] })));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow(/invalid song details/);
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: 'none' })));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow(/invalid response/);
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: Array.from({ length: 11 }, () => ({ title: 'Song', artist: 'Artist' })) })));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow(/up to 10 songs/);
  });

  it('gives a clear helper-not-running or origin-not-allowed error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow(/helper is not running or did not allow this extension origin/);
  });

  it('propagates cancellation and bounds the request with a 45-second timeout', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const pending = recognizeLocal(new Blob(), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });

    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const timed = recognizeLocal(new Blob(), new AbortController().signal);
    const timeoutAssertion = expect(timed).rejects.toThrow('Local Shazam helper request timed out.');
    await vi.advanceTimersByTimeAsync(45_000);
    await timeoutAssertion;
  });

  it('surfaces a bounded helper error for non-success HTTP responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Sample too short.' }, 422)));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow('Local Shazam helper: Sample too short.');
  });

  it('surfaces a structured helper error even when returned with HTTP success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Recognition unavailable.' })));
    await expect(recognizeLocal(new Blob(), new AbortController().signal)).rejects.toThrow('Local Shazam helper: Recognition unavailable.');
  });
});
