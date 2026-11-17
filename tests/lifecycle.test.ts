import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { ensureHelperMock, releaseHelperMock } = vi.hoisted(() => ({ ensureHelperMock: vi.fn(), releaseHelperMock: vi.fn() }));
vi.mock('../src/native-helper', () => ({ ensureLocalHelper: ensureHelperMock, releaseLocalHelper: releaseHelperMock }));

type Listener = (...args: any[]) => unknown;
type Store = Record<string, unknown>;

describe('background job lifecycle', () => {
  let session: Store;
  let local: Store;
  let messageListeners: Listener[];
  let removedListeners: Listener[];
  let windowRemoved: Listener;
  let windows: Array<{ id: number }>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let createDocument: ReturnType<typeof vi.fn>;
  let getMediaStreamId: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ensureHelperMock.mockReset().mockResolvedValue(undefined);
    releaseHelperMock.mockReset();
    vi.resetModules();
    session = {};
    local = {};
    messageListeners = [];
    removedListeners = [];
    windows = [{ id: 1 }];
    sendMessage = vi.fn(async (message: { type?: string }) => message.type === 'OFFSCREEN_STATUS' ? { running: true } : { ok: true });
    createDocument = vi.fn(async () => undefined);
    getMediaStreamId = vi.fn((_options: unknown, callback: (streamId: string) => void) => callback('stream-1'));
    const storageArea = (data: Store) => ({
      get: vi.fn(async (keys: string | string[]) => Array.isArray(keys)
        ? Object.fromEntries(keys.map((key) => [key, data[key]]))
        : { [keys]: data[keys] }),
      set: vi.fn(async (values: Store) => Object.assign(data, values)),
      remove: vi.fn(async (key: string) => { delete data[key]; })
    });
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        onMessage: { addListener: (listener: Listener) => messageListeners.push(listener) },
        onStartup: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        ContextType: { OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT' },
        getURL: (path: string) => `chrome-extension://extension-id/${path}`,
        getContexts: vi.fn((_filter: unknown, callback: (contexts: unknown[]) => void) => callback([])),
        sendMessage
      },
      storage: { session: storageArea(session), local: storageArea(local) },
      windows: {
        getAll: vi.fn(async () => windows),
        onRemoved: { addListener: (listener: Listener) => { windowRemoved = listener; } },
      },
      tabs: {
        query: vi.fn(async () => [{ id: 7 }]),
        onRemoved: { addListener: (listener: Listener) => removedListeners.push(listener) }
      },
      tabCapture: { getMediaStreamId },
      offscreen: { createDocument, Reason: { USER_MEDIA: 'USER_MEDIA' } }
    });
    await import('../src/background');
    await flush();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('surfaces a browser stream-id timeout instead of leaving the popup recording forever', async () => {
    vi.useFakeTimers();
    session.settings = { provider: 'local-shazam', remember: false };
    getMediaStreamId.mockImplementationOnce(() => {});
    let response: any;
    messageListeners[0]!({ type: 'START' }, { id: 'extension-id' }, (value: unknown) => { response = value; });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(response.error).toContain('within 8 seconds');
    expect(session.job).toMatchObject({ stage: 'failed' });
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_START' }));
  });

  it('launches on popup readiness only for Local Shazam, without launching during background startup', async () => {
    expect(ensureHelperMock).not.toHaveBeenCalled();
    await dispatch({ type: 'ENSURE_HELPER' });
    expect(ensureHelperMock).not.toHaveBeenCalled();
    session.settings = { provider: 'local-shazam', remember: false };
    await expect(dispatch({ type: 'ENSURE_HELPER' })).resolves.toMatchObject({ ok: true });
    expect(ensureHelperMock).toHaveBeenCalledTimes(1);
  });

  it('releases the helper only after the last browser window closes', async () => {
    windowRemoved(2);
    await flush();
    expect(releaseHelperMock).not.toHaveBeenCalled();
    windows = [];
    windowRemoved(1);
    await flush();
    expect(releaseHelperMock).toHaveBeenCalledOnce();
    expect(ensureHelperMock).not.toHaveBeenCalled();
  });

  it('refuses to capture when on-demand helper startup fails', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    ensureHelperMock.mockRejectedValue(new Error('Native helper setup missing.'));
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ error: 'Native helper setup missing.' });
    expect(getMediaStreamId).not.toHaveBeenCalled();
  });

  it('rejects an empty browser stream ID before attempting capture', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    getMediaStreamId.mockImplementationOnce((_options: unknown, callback: (id: string) => void) => callback(''));
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ error: expect.stringContaining('empty tab audio stream') });
    expect(session.job).toMatchObject({ stage: 'failed' });
  });

  it('refuses to start without explicit free access confirmation and a key', async () => {
    const response = await dispatch({ type: 'START' });
    expect(response.error).toMatch(/free access/i);
    expect(getMediaStreamId).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  async function useStoreEdition() {
    vi.stubGlobal('ANIOTO_STORE_CONFIG', { recognitionUrl: 'https://release.example/v1/recognize', helperUrl: 'https://release.example/companion' });
    messageListeners.length = 0;
    vi.resetModules();
    await import('../src/background');
    await flush();
  }

  it('defaults the store edition to SongRec without starting the helper during background startup', async () => {
    await useStoreEdition();
    expect(ensureHelperMock).not.toHaveBeenCalled();
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_START', provider: 'songrec' }));
    expect(ensureHelperMock).toHaveBeenCalledOnce();
  });

  it('requires explicit AudD consent before capture and uses only that provider when enabled', async () => {
    await useStoreEdition();
    local.preferredProvider = 'audd';
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ error: expect.stringContaining('Allow AudD') });
    expect(getMediaStreamId).not.toHaveBeenCalled();
    local.settings = { auddConsent: true };
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true, job: { captureSeconds: 8 } });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_START', provider: 'audd' }));
    expect(ensureHelperMock).not.toHaveBeenCalled();
  });

  it('records stream acquisition failures and permits a later retry', async () => {
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    getMediaStreamId.mockImplementationOnce((_options: unknown, callback: (streamId: string) => void) => {
      (chrome.runtime as unknown as { lastError?: { message: string } }).lastError = { message: 'Capture is unavailable for this tab.' };
      callback('');
      delete (chrome.runtime as unknown as { lastError?: { message: string } }).lastError;
    });
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ error: 'Capture is unavailable for this tab.' });
    expect(session.job).toMatchObject({ stage: 'failed' });

    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true, job: { stage: 'capturing' } });
    expect(getMediaStreamId).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_START', streamId: 'stream-1' }));
  });

  it('allows a local diagnostic capture without a key or quota debit', async () => {
    await expect(dispatch({ type: 'TEST_CAPTURE' })).resolves.toMatchObject({ ok: true, job: { stage: 'capturing' } });
    expect(getMediaStreamId).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_TEST_CAPTURE', streamId: 'stream-1' }));
    expect(local.dailyUsage).toBeUndefined();
  });

  it('starts the local Shazam provider without an AudioTag key or free-access confirmation', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true, job: { stage: 'capturing' } });
    expect(getMediaStreamId).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ target: 'offscreen', type: 'OFFSCREEN_START' }));
    const start = sendMessage.mock.calls.find(([message]) => (message as { type?: string }).type === 'OFFSCREEN_START')?.[0] as Record<string, unknown>;
    expect(start.provider).toBe('local-shazam');
    expect('apiKey' in start).toBe(false);
    expect(local.dailyUsage).toBeUndefined();
  });

  it.each(['local-shazam', 'songrec'])('restores the saved %s choice after session settings are cleared', async provider => {
    local.preferredProvider = provider;
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true, job: { stage: 'capturing' } });
    const start = sendMessage.mock.calls.find(([message]) => (message as { type?: string }).type === 'OFFSCREEN_START')?.[0] as Record<string, unknown>;
    expect(start.provider).toBe(provider);
    expect('apiKey' in start).toBe(false);
    expect(local.dailyUsage).toBeUndefined();
  });

  it('cancels only when the originally captured tab closes', async () => {
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    await dispatch({ type: 'START' });

    removedListeners.forEach((listener) => listener(99));
    await flush();
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_CANCEL' }));

    removedListeners.forEach((listener) => listener(7));
    await flush();
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_CANCEL' }));
    expect(session.job).toMatchObject({ stage: 'cancelled' });
  });

  it('preserves request start time across stages and freezes completion time', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    await dispatch({ type: 'START' });
    const initial = session.job as { id: string; startedAt: number };
    expect(initial.startedAt).toBe(1000);
    vi.mocked(Date.now).mockReturnValue(16000);
    const publish = (stage: string) => new Promise(resolve => messageListeners[1]!({
      target: 'background', type: 'JOB_UPDATE', job: { id: initial.id, stage, message: stage }
    }, { id: 'extension-id' }, resolve));
    await publish('submitting');
    expect(session.job).toMatchObject({ startedAt: 1000, stageStartedAt: 16000 });
    vi.mocked(Date.now).mockReturnValue(18000);
    await publish('complete');
    expect(session.job).toMatchObject({ startedAt: 1000, finishedAt: 18000 });
    vi.mocked(Date.now).mockReturnValue(22000);
    await publish('complete');
    expect(session.job).toMatchObject({ finishedAt: 18000 });
  });

  it('ignores stale job updates', async () => {
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    await dispatch({ type: 'START' });
    const current = session.job as { id: string; stage: string };
    messageListeners.forEach((listener) => listener({
      target: 'background', type: 'JOB_UPDATE', job: { id: 'old-job', stage: 'complete', message: 'stale result' }
    }, { id: 'extension-id' }, vi.fn()));
    await flush();
    expect(session.job).toMatchObject({ id: current.id, stage: 'capturing' });
  });

  it.each(['awaiting recognition', 'listening and recognizing'])('keeps an active %s job when the offscreen document confirms it is running', async (stage) => {
    session.job = { id: 'recoverable', stage, message: 'working' };
    session.captureTabId = 7;
    vi.mocked(chrome.runtime.getContexts).mockImplementationOnce((_filter, callback) => callback([{} as never]));
    await vi.resetModules();
    await import('../src/background');
    await flush();
    expect(sendMessage).toHaveBeenCalledWith({ target: 'offscreen', type: 'OFFSCREEN_STATUS', id: 'recoverable' });
    expect(session.job).toMatchObject({ id: 'recoverable', stage });
  });

  it('keeps progressive updates active, refuses duplicate starts, and supports cancel', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    await dispatch({ type: 'START' });
    const current = session.job as { id: string };
    await new Promise(resolve => messageListeners[1]!({ target: 'background', type: 'JOB_UPDATE', job: { id: current.id, stage: 'listening and recognizing', message: 'Checking 3 seconds.' } }, { id: 'extension-id' }, resolve));
    expect(session.job).not.toHaveProperty('finishedAt');
    await dispatch({ type: 'START' });
    expect(getMediaStreamId).toHaveBeenCalledTimes(1);
    expect(session.job).toMatchObject({ id: current.id, stage: 'listening and recognizing' });
    await dispatch({ type: 'CANCEL' });
    expect(session.job).toMatchObject({ stage: 'cancelled' });
  });

  it('marks the active job cancelled and notifies the offscreen document', async () => {
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    await dispatch({ type: 'START' });
    await dispatch({ type: 'CANCEL' });
    expect(session.job).toMatchObject({ stage: 'cancelled' });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OFFSCREEN_CANCEL' }));
  });

  it('starts a new capture only after the previous job acknowledges cancellation', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    const prior = await dispatch({ type: 'START' });
    let finishCancel!: () => void;
    sendMessage.mockImplementationOnce(() => new Promise<void>(resolve => { finishCancel = resolve; }));
    const cancel = dispatch({ type: 'CANCEL' });
    const retry = dispatch({ type: 'START' });
    await flush();
    expect(getMediaStreamId).toHaveBeenCalledTimes(1);
    finishCancel();
    await cancel;
    const next = await retry;
    expect(next.ok).toBe(true);
    expect(next.job.id).not.toBe(prior.job.id);
    expect(getMediaStreamId).toHaveBeenCalledTimes(2);
  });

  it('discards a late capture stream when the user cancels and scans again', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    let staleStream!: (id: string) => void;
    getMediaStreamId.mockImplementationOnce((_options, callback) => { staleStream = callback; });
    const original = dispatch({ type: 'START' });
    await flush();
    expect(getMediaStreamId).toHaveBeenCalledOnce();
    await dispatch({ type: 'CANCEL' });
    const next = await dispatch({ type: 'START' });
    staleStream('late-stream');
    await original;
    const recordings = sendMessage.mock.calls.map(([message]) => message).filter(message => message.type === 'OFFSCREEN_START');
    expect(recordings).toMatchObject([{ id: next.job.id, streamId: 'stream-1' }]);
  });

  it('starts local Shazam even after the legacy daily counter reaches its limit', async () => {
    session.settings = { provider: 'local-shazam', remember: false };
    local.dailyUsage = { date: localDateKey(), count: 20 };
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ ok: true });
    expect(getMediaStreamId).toHaveBeenCalledTimes(1);
    expect(local.dailyUsage).toMatchObject({ count: 20 });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ provider: 'local-shazam', type: 'OFFSCREEN_START' }));
  });

  it('keeps the AudioTag daily capture limit', async () => {
    session.settings = { apiKey: 'test-key', freeAccessConfirmed: true, remember: false };
    local.dailyUsage = { date: localDateKey(), count: 20 };
    await expect(dispatch({ type: 'START' })).resolves.toMatchObject({ error: expect.stringMatching(/limit of 20/i) });
    expect(getMediaStreamId).not.toHaveBeenCalled();
  });

  async function dispatch(message: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`No response for ${JSON.stringify(message)}`)), 1000);
      const callback = (response: unknown) => { clearTimeout(timeout); resolve(response); };
      try {
        const result = messageListeners[0]?.(message, { id: 'extension-id' }, callback);
        if (result !== true) { clearTimeout(timeout); resolve(undefined); }
      } catch (error) { reject(error); }
    });
  }
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function localDateKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
