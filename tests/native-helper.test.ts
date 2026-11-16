import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureLocalHelper, releaseLocalHelper } from '../src/native-helper';

let connect: ReturnType<typeof vi.fn>;
let post: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;
let receive: (message: unknown) => void;
let onDisconnect: () => void;
const healthy = () => new Response(JSON.stringify({
  ok: true, provider: 'shazamio', allowedOrigins: ['chrome-extension://test-id'],
}));

beforeEach(() => {
  post = vi.fn().mockImplementation(() => receive({ ok: true }));
  disconnect = vi.fn();
  connect = vi.fn().mockImplementation(() => ({
    postMessage: post,
    disconnect,
    onMessage: { addListener: (listener: typeof receive) => { receive = listener; } },
    onDisconnect: { addListener: (listener: typeof onDisconnect) => { onDisconnect = listener; } },
  }));
  vi.stubGlobal('chrome', { runtime: { id: 'test-id', connectNative: connect } });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
});

afterEach(() => { releaseLocalHelper(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps one native browser connection across popup and identify calls', async () => {
  const first = ensureLocalHelper();
  expect(ensureLocalHelper()).toBe(first);
  await first;
  expect(connect).toHaveBeenCalledWith('com.otone.helper');
  expect(post).toHaveBeenCalledWith({ type: 'ensureHelper' });
  vi.stubGlobal('fetch', vi.fn(async () => healthy()));
  await ensureLocalHelper();
  expect(connect).toHaveBeenCalledOnce();
  expect(disconnect).not.toHaveBeenCalled();
  releaseLocalHelper();
  expect(disconnect).toHaveBeenCalledOnce();
});

it('opens a fresh connection after the last window closes', async () => {
  await ensureLocalHelper();
  releaseLocalHelper();
  expect(disconnect).toHaveBeenCalledOnce();
  await ensureLocalHelper();
  expect(connect).toHaveBeenCalledTimes(2);
});

it('falls back to a healthy manually started helper when the native host is absent', async () => {
  connect.mockImplementation(() => { throw new Error('missing host'); });
  vi.stubGlobal('fetch', vi.fn(async () => healthy()));
  await expect(ensureLocalHelper()).resolves.toBeUndefined();
  expect(post).not.toHaveBeenCalled();
});

it('rejects wrong-origin health and surfaces native setup failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, provider: 'shazamio', allowedOrigins: ['chrome-extension://other-id'] }))));
  post.mockImplementation(() => {
    Object.assign(chrome.runtime, { lastError: { message: 'host not found' } });
    onDisconnect();
  });
  await expect(ensureLocalHelper()).rejects.toThrow('Install the Anioto native helper once');
});

it('disconnects a stalled native launch, ignores late replies, and retries', async () => {
  vi.useFakeTimers();
  post.mockImplementationOnce(() => undefined);
  const assertion = expect(ensureLocalHelper()).rejects.toThrow('taking too long');
  await vi.advanceTimersByTimeAsync(20_000);
  await assertion;
  expect(disconnect).toHaveBeenCalledOnce();
  receive({ ok: true });
  await expect(ensureLocalHelper()).resolves.toBeUndefined();
  expect(connect).toHaveBeenCalledTimes(2);
});

it('cancels a pending lease on browser close', async () => {
  post.mockImplementationOnce(() => undefined);
  const launch = expect(ensureLocalHelper()).rejects.toThrow('browser session closed');
  releaseLocalHelper();
  await launch;
  expect(disconnect).toHaveBeenCalledOnce();
});
