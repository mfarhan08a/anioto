import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const url = 'https://recognition.example/v1/recognize';
const clip = new Blob(['test'], { type: 'audio/wav' });

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('ANIOTO_STORE_CONFIG', { recognitionUrl: url, helperUrl: 'https://recognition.example/companion' });
});

afterEach(() => vi.unstubAllGlobals());

it('rejects local-only store calls without sending any network request', async () => {
  vi.stubGlobal('ANIOTO_STORE_CONFIG', { recognitionUrl: null, helperUrl: 'https://github.com/mfarhan08a/anioto' });
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { recognizeAudD } = await import('../src/providers/audd');
  await expect(recognizeAudD(clip, new AbortController().signal)).rejects.toThrow('not available');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('makes one request without credentials in the client and distinguishes a miss from quota exhaustion', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(null)).mockResolvedValueOnce(new Response(null, { status: 429 }));
  vi.stubGlobal('fetch', fetchMock);
  const { recognizeAudD } = await import('../src/providers/audd');
  const signal = new AbortController().signal;
  await expect(recognizeAudD(clip, signal)).resolves.toEqual([]);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ body: clip, credentials: 'omit', headers: { 'Content-Type': 'audio/wav' } }));
  await expect(recognizeAudD(clip, signal)).rejects.toThrow('usage limit');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('passes cancellation to the request and allows a new scan immediately', async () => {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (fetchMock.mock.calls.length > 1) return Response.json({ title: 'Next song', artist: 'Artist' });
    return await new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const { recognizeAudD } = await import('../src/providers/audd');
  const first = new AbortController();
  const pending = recognizeAudD(clip, first.signal);
  first.abort();
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  await expect(recognizeAudD(clip, new AbortController().signal)).resolves.toEqual([{ title: 'Next song', artist: 'Artist' }]);
});
