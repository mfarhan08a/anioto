import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock, recognizeMock, recognizeProgressiveMock, resolveAnimeMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  recognizeMock: vi.fn(),
  recognizeProgressiveMock: vi.fn(),
  resolveAnimeMock: vi.fn()
}));
vi.mock('../src/capture', () => ({ captureTabAudio: captureMock }));
vi.mock('../src/providers/audiotag', () => ({ recognize: recognizeMock }));
vi.mock('../src/providers/progressive-shazam', () => ({ recognizeProgressive: recognizeProgressiveMock }));
vi.mock('../src/providers/anime', () => ({ resolveAnime: resolveAnimeMock }));

type Listener = (...args: any[]) => unknown;

describe('offscreen recognition lifecycle', () => {
  let listeners: Listener[];
  let updates: Array<{ id: string; stage: string; message: string; result?: unknown; previewUrl?: string }>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    listeners = [];
    updates = [];
    createObjectURL = vi.fn(() => 'blob:diagnostic-sample');
    revokeObjectURL = vi.fn();
    captureMock.mockReset().mockResolvedValue(new Blob(['wav']));
    recognizeMock.mockReset().mockResolvedValue([{ title: 'Theme', artist: 'Singer' }]);
    recognizeProgressiveMock.mockReset().mockResolvedValue([{ title: 'Akane Sasu (instrumental)', artist: 'Aimer' }]);
    resolveAnimeMock.mockReset().mockResolvedValue([]);
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        onMessage: { addListener: (listener: Listener) => listeners.push(listener) },
        sendMessage: vi.fn(async (message: { job?: { id: string; stage: string; message: string; result?: unknown } }) => {
          if (message.job) updates.push(message.job);
          return undefined;
        })
      }
    });
    class URLMock extends URL {}
    Object.assign(URLMock, { createObjectURL, revokeObjectURL });
    vi.stubGlobal('URL', URLMock);
    await import('../src/offscreen');
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('marks multiple distinct recognition candidates ambiguous without resolving one arbitrarily', async () => {
    recognizeMock.mockResolvedValue([
      { title: 'First song', artist: 'Artist A' },
      { title: 'Second song', artist: 'Artist B' }
    ]);
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_START', id: 'ambiguous', streamId: 'stream', apiKey: 'key' });
    await waitForStage('ambiguous');
    expect(resolveAnimeMock).not.toHaveBeenCalled();
    expect(updates.at(-1)?.message).toContain('First song');
    expect(updates.at(-1)?.message).toContain('Second song');
  });

  it('aborts an in-flight recognition request and publishes cancellation', async () => {
    let recognitionSignal: AbortSignal | undefined;
    recognizeMock.mockImplementation((_blob: Blob, _key: string, signal: AbortSignal) => new Promise((_resolve, reject) => {
      recognitionSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_START', id: 'cancel-me', streamId: 'stream', apiKey: 'key' });
    await waitUntil(() => Boolean(recognitionSignal));
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_CANCEL', id: 'cancel-me' });
    await waitForStage('cancelled');
    expect(recognitionSignal?.aborted).toBe(true);
    expect(resolveAnimeMock).not.toHaveBeenCalled();
  });

  it.each(['local-shazam', 'songrec'])('uses progressive %s recognition and publishes the anime before optional artwork finishes', async provider => {
    const anime = [{ id: 2033, title: 'Natsume Yuujinchou Go', sourceUrl: 'https://animethemes.moe/anime/natsume_yuujinchou_go', evidence: 'Aimer ED credit', matchKind: 'version' }];
    resolveAnimeMock.mockImplementation(async (_song, _signal, onMatches) => { await onMatches(anime); return anime; });
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_START', id: 'short-local', streamId: 'stream', provider });
    await waitForStage('complete');
    expect(recognizeProgressiveMock).toHaveBeenCalledWith('stream', expect.any(AbortSignal), expect.any(Function), provider);
    expect(captureMock).not.toHaveBeenCalled();
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({ stage: 'listening and recognizing', captureSeconds: 12 }));
    expect(updates).toContainEqual(expect.objectContaining({ stage: 'resolving anime', result: expect.objectContaining({ anime }) }));
    expect(updates.at(-1)?.result).toMatchObject({ anime });
  });

  it('shows overlapping recognition progress and cancels the progressive request', async () => {
    let activeSignal: AbortSignal | undefined;
    recognizeProgressiveMock.mockImplementation((_stream, signal: AbortSignal, progress) => new Promise((_resolve, reject) => {
      activeSignal = signal;
      progress({ phase: 'listening', capturing: true });
      progress({ phase: 'recognizing', sampleSeconds: 3, capturing: true });
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }));
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_START', id: 'progressive-cancel', streamId: 'stream', provider: 'local-shazam' });
    await waitUntil(() => Boolean(activeSignal));
    expect(updates.some(job => job.message.includes('3-second sample while listening continues'))).toBe(true);
    expect(updates.some(job => job.message.includes('undefined'))).toBe(false);
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_CANCEL', id: 'progressive-cancel' });
    await waitForStage('cancelled');
    expect(activeSignal?.aborted).toBe(true);
    expect(resolveAnimeMock).not.toHaveBeenCalled();
  });

  it('does not announce title-only cover candidates as confirmed', async () => {
    resolveAnimeMock.mockResolvedValue([{ id: 1, title: 'Candidate anime', sourceUrl: 'https://example.test', evidence: 'Title only', matchKind: 'possible' }]);
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_LOOKUP', id: 'possible', song: { title: 'Song', artist: 'Cover artist' } });
    await waitForStage('complete');
    expect(updates.at(-1)?.message).toMatch(/Possible anime connections/);
    expect(updates.at(-1)?.message).toMatch(/not confirmed/);
  });

  it('returns the recognized song when anime metadata has no association', async () => {
    resolveAnimeMock.mockResolvedValue([]);
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_LOOKUP', id: 'partial', song: { title: 'Song', artist: 'Artist' } });
    await waitForStage('song-only');
    expect(updates.at(-1)?.result).toEqual({ song: { title: 'Song', artist: 'Artist' }, anime: [] });
    expect(updates.at(-1)?.message).toMatch(/no documented anime connection/i);
    expect(updates.at(-1)?.message).not.toMatch(/song identified/i);
  });

  it('keeps a local diagnostic sample playable without recognizing or uploading it', async () => {
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_TEST_CAPTURE', id: 'diagnostic', streamId: 'stream' });
    await waitForStage('sample-ready');
    expect(captureMock).toHaveBeenCalledWith('stream', expect.any(AbortSignal));
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(resolveAnimeMock).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(updates.at(-1)).toMatchObject({
      message: 'Local recording ready. Play it to check what was captured. Nothing was uploaded.',
      previewUrl: 'blob:diagnostic-sample'
    });
  });

  it('revokes the preview after its 120-second lifetime', async () => {
    const realSetTimeout = globalThis.setTimeout;
    let expire!: () => void;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay === 120_000) { expire = callback as () => void; return 1 as never; }
      return realSetTimeout(callback, delay);
    }) as typeof setTimeout);
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_TEST_CAPTURE', id: 'diagnostic-ttl', streamId: 'stream' });
    await waitForStage('sample-ready');
    expire();
    await waitForStage('sample-expired');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostic-sample');
  });

  it('revokes the previous preview when another job starts', async () => {
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_TEST_CAPTURE', id: 'diagnostic-next', streamId: 'stream' });
    await waitForStage('sample-ready');
    await dispatch({ target: 'offscreen', type: 'OFFSCREEN_LOOKUP', id: 'lookup-next', song: { title: 'Song', artist: 'Artist' } });
    await waitForStage('song-only');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostic-sample');
  });

  async function dispatch(message: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`No offscreen response for ${JSON.stringify(message)}`)), 1000);
      const callback = (response: unknown) => { clearTimeout(timeout); resolve(response); };
      const result = listeners[0]?.(message, { id: 'extension-id' }, callback);
      if (result !== true) { clearTimeout(timeout); resolve(undefined); }
    });
  }

  async function waitForStage(stage: string): Promise<void> {
    await waitUntil(() => updates.some((job) => job.stage === stage));
  }
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1500;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 0));
  if (!predicate()) throw new Error('Timed out waiting for offscreen job update.');
}
