import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioSnapshot } from '../src/capture';
import { recognizeProgressive } from '../src/providers/progressive-shazam';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  resample: vi.fn(),
  recognize: vi.fn()
}));
vi.mock('../src/capture', () => ({ captureTabAudio: mocks.capture, resampleMonoToWav: mocks.resample }));
vi.mock('../src/providers/local-shazam', () => ({ recognizeLocal: mocks.recognize }));

const song = { title: 'Snow Sound', artist: 'Novelbright' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let emitSnapshot: ((snapshot: AudioSnapshot) => void) | undefined;
let finishCapture: (() => void) | undefined;
let rejectCapture: ((error: unknown) => void) | undefined;
function setupCapture() {
  mocks.capture.mockImplementation((_streamId: string, signal: AbortSignal, _seconds: number, callback: (snapshot: AudioSnapshot) => void) => {
    emitSnapshot = callback;
    callback({ samples: new Float32Array([3]), sampleRate: 32_000, seconds: 3 });
    return new Promise<Blob>((resolve, reject) => {
      finishCapture = () => resolve(new Blob(['capture wav']));
      rejectCapture = reject;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  });
  mocks.resample.mockImplementation(async (samples: Float32Array) => new Blob([String(samples[0])]));
  mocks.recognize.mockResolvedValue([]);
}
function emitSnapshotAt(seconds: AudioSnapshot['seconds']) {
  emitSnapshot?.({ samples: new Float32Array([seconds]), sampleRate: 32_000, seconds });
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  emitSnapshot = undefined;
  finishCapture = undefined;
  rejectCapture = undefined;
});

describe('progressive local Shazam recognition', () => {
  it('returns the first match and stops capture before later checkpoints', async () => {
    setupCapture();
    mocks.recognize.mockResolvedValue([song, song]);
    const result = recognizeProgressive('stream', new AbortController().signal);
    await tick();
    expect(mocks.capture).toHaveBeenCalledWith('stream', expect.any(AbortSignal), 12, expect.any(Function));
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toEqual([song]);
    emitSnapshotAt(6);
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
  });

  it('coalesces intermediate snapshots during an in-flight request and tries only the latest', async () => {
    setupCapture();
    const request = deferred<typeof song[]>();
    mocks.recognize.mockReturnValueOnce(request.promise).mockResolvedValueOnce([song]);
    const result = recognizeProgressive('stream', new AbortController().signal);
    await tick();
    emitSnapshotAt(6);
    emitSnapshotAt(9);
    emitSnapshotAt(12);
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    request.resolve([]);
    await expect(result).resolves.toEqual([song]);
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
    expect(await (mocks.recognize.mock.calls[1]![0] as Blob).text()).toBe('12');
  });

  it('returns no match after capture finishes and the final pending checkpoint is recognized', async () => {
    setupCapture();
    mocks.recognize.mockResolvedValue([]);
    const result = recognizeProgressive('stream', new AbortController().signal);
    await tick();
    emitSnapshotAt(12);
    finishCapture?.();
    await expect(result).resolves.toEqual([]);
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
  });

  it('propagates a provider error once and aborts capture without trying longer audio', async () => {
    setupCapture();
    mocks.recognize.mockRejectedValue(new Error('HTTP 429'));
    const result = recognizeProgressive('stream', new AbortController().signal);
    await expect(result).rejects.toThrow('HTTP 429');
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    expect(rejectCapture).toBeDefined();
  });

  it('cancels immediately during capture, conversion, and recognition without late progress events', async () => {
    setupCapture();
    const controller = new AbortController();
    const progress = vi.fn();
    const result = recognizeProgressive('stream', controller.signal, progress);
    await tick();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    emitSnapshotAt(6);
    await tick();
    expect(progress).toHaveBeenCalledTimes(2);
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
  });

  it('cancels while conversion is pending and ignores its late completion', async () => {
    setupCapture();
    const conversion = deferred<Blob>();
    mocks.resample.mockReturnValueOnce(conversion.promise);
    const controller = new AbortController();
    const progress = vi.fn();
    const result = recognizeProgressive('stream', controller.signal, progress);
    await tick();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    conversion.resolve(new Blob(['late conversion']));
    await tick();
    expect(mocks.recognize).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it('does not overlap slow conversions even when capture sends later checkpoints', async () => {
    setupCapture();
    const conversion = deferred<Blob>();
    mocks.resample.mockReturnValueOnce(conversion.promise);
    mocks.recognize.mockResolvedValue([]);
    const result = recognizeProgressive('stream', new AbortController().signal);
    await tick();
    emitSnapshotAt(6);
    emitSnapshotAt(9);
    emitSnapshotAt(12);
    expect(mocks.resample).toHaveBeenCalledTimes(1);
    conversion.resolve(new Blob(['3']));
    finishCapture?.();
    await expect(result).resolves.toEqual([]);
    expect(mocks.resample).toHaveBeenCalledTimes(2);
    expect(await (mocks.recognize.mock.calls[1]![0] as Blob).text()).toBe('12');
  });

  it('returns a 3-second match at 3.5 seconds and aborts only the capture signal', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    let captureSignal: AbortSignal | undefined;
    mocks.capture.mockImplementation((_streamId: string, signal: AbortSignal, _seconds: number, callback: (snapshot: AudioSnapshot) => void) => {
      captureSignal = signal;
      emitSnapshot = callback;
      return new Promise<Blob>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        setTimeout(() => callback({ samples: new Float32Array([3]), sampleRate: 32_000, seconds: 3 }), 3_000);
      });
    });
    mocks.resample.mockResolvedValue(new Blob(['3']));
    mocks.recognize.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([song]), 500)));

    const result = recognizeProgressive('stream', caller.signal);
    await vi.advanceTimersByTimeAsync(3_499);
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([song]);
    expect(captureSignal?.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out after 65 seconds during a noncooperative request and ignores late snapshots', async () => {
    vi.useFakeTimers();
    let captureSignal: AbortSignal | undefined;
    mocks.capture.mockImplementation((_streamId: string, signal: AbortSignal, _seconds: number, callback: (snapshot: AudioSnapshot) => void) => {
      captureSignal = signal;
      callback({ samples: new Float32Array([3]), sampleRate: 32_000, seconds: 3 });
      return new Promise<Blob>(() => undefined);
    });
    mocks.resample.mockResolvedValue(new Blob(['3']));
    mocks.recognize.mockReturnValue(new Promise(() => undefined));
    const progress = vi.fn();
    const result = recognizeProgressive('stream', new AbortController().signal, progress);
    const rejection = expect(result).rejects.toThrow('Progressive Shazam recognition timed out.');
    await tick();
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(65_000);
    await rejection;
    expect(captureSignal?.aborted).toBe(true);
    const progressCountAtEnd = progress.mock.calls.length;
    emitSnapshotAt(6);
    await tick();
    expect(progress).toHaveBeenCalledTimes(progressCountAtEnd);
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates silent capture failure without calling recognition', async () => {
    mocks.capture.mockRejectedValue(new Error('No audible tab audio was detected.'));
    const result = recognizeProgressive('stream', new AbortController().signal);
    await expect(result).rejects.toThrow('No audible tab audio was detected.');
    expect(mocks.recognize).not.toHaveBeenCalled();
  });
});
