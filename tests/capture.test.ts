import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureTabAudio, encodeWav, type AudioSnapshot } from '../src/capture';

interface FakeAudioState {
  input: Float32Array;
  right?: Float32Array;
  output?: Float32Array;
  process?: () => void;
  disconnects: number;
  closes: number;
  stopped: number;
  sourceConnectedToPlayback: boolean;
  sourceConnectedToProcessor: boolean;
  processorConnectedToDestination: boolean;
  processorPortClosed: boolean;
  processorName?: string;
  processorOptions?: AudioWorkletNodeOptions;
  workletUrl?: string;
  workletTotalFrames: number;
  offlineInput?: Float32Array;
  offlineOutputLength?: number;
  offlineOutputRate?: number;
  sourceBufferRate?: number;
  mediaConstraints?: MediaStreamConstraints;
}

describe('tab audio capture', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('does not request media when already aborted', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const controller = new AbortController();
    controller.abort();
    await expect(captureTabAudio('stream-id', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('releases a stream when cancelled while getUserMedia is still pending', async () => {
    const state = audioState();
    let release!: (stream: MediaStream) => void;
    const pending = new Promise<MediaStream>((resolve) => { release = resolve; });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => pending) } });
    vi.stubGlobal('AudioContext', fakeAudioContext(state));
    const controller = new AbortController();
    const capture = captureTabAudio('stream-id', controller.signal);
    controller.abort();
    release(fakeStream(state) as unknown as MediaStream);
    await expect(capture).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(0);
  });

  it('stops tracks and disconnects the audio graph when cancelled during capture', async () => {
    vi.useFakeTimers();
    const state = audioState();
    stubCaptureEnvironment(state);
    const controller = new AbortController();
    const capture = captureTabAudio('stream-id', controller.signal);
    await flush();
    controller.abort();
    await expect(capture).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.stopped).toBe(1);
    expect(state.disconnects).toBeGreaterThanOrEqual(2);
    expect(state.closes).toBe(1);
  });

  it('releases the acquired stream if AudioContext setup fails', async () => {
    const state = audioState();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(state)) } });
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('AudioContext unavailable'); } });
    await expect(captureTabAudio('stream-id', new AbortController().signal)).rejects.toThrow(/AudioContext unavailable/);
    expect(state.stopped).toBe(1);
  });

  it('releases the stream and closes the context if worklet loading fails', async () => {
    const state = audioState();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(state)) } });
    vi.stubGlobal('AudioContext', class {
      audioWorklet = { addModule: vi.fn(async () => { throw new Error('worklet unavailable'); }) };
      async close() { state.closes++; }
    });
    vi.stubGlobal('chrome', { runtime: { getURL: (file: string) => `extension://${file}` } });
    await expect(captureTabAudio('stream-id', new AbortController().signal)).rejects.toThrow(/worklet unavailable/);
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('cancels a pending worklet load and cleans up once the load eventually resolves', async () => {
    const state = audioState();
    let resolveModule!: () => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(state)) } });
    vi.stubGlobal('AudioContext', class {
      sampleRate = 44_100;
      destination = {};
      audioWorklet = { addModule: () => new Promise<void>((resolve) => { resolveModule = resolve; }) };
      async close() { state.closes++; }
    });
    vi.stubGlobal('chrome', { runtime: { getURL: (file: string) => `extension://${file}` } });
    const controller = new AbortController();
    const capture = captureTabAudio('stream-id', controller.signal);
    await flush();
    controller.abort();
    await expect(capture).rejects.toMatchObject({ name: 'AbortError' });
    resolveModule();
    await flush();
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('times out a stalled worklet load and releases the stream and context', async () => {
    vi.useFakeTimers();
    const state = audioState();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(state)) } });
    vi.stubGlobal('AudioContext', class {
      sampleRate = 44_100;
      destination = {};
      audioWorklet = { addModule: vi.fn(() => new Promise<void>(() => undefined)) };
      async close() { state.closes++; }
    });
    vi.stubGlobal('chrome', { runtime: { getURL: (file: string) => `extension://${file}` } });
    const capture = captureTabAudio('stream-id', new AbortController().signal);
    await flush();
    const rejected = expect(capture).rejects.toThrow(/timed out while loading the audio capture worklet/i);
    await vi.advanceTimersByTimeAsync(8_000);
    await rejected;
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('plays the original stereo source directly and routes capture through a bounded worklet', async () => {
    vi.useFakeTimers();
    const state = audioState();
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal);
    await flush();
    expect(state.sourceConnectedToPlayback).toBe(true);
    expect(state.sourceConnectedToProcessor).toBe(true);
    expect(state.processorConnectedToDestination).toBe(true);
    expect(state.processorName).toBe('anime-song-capture');
    expect(state.processorOptions).toMatchObject({ numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { maxFrames: 44_100 * 15 } });
    expect(state.workletUrl).toBe('extension://audio-capture-worklet.js');
    const constraints = state.mediaConstraints?.audio as MediaTrackConstraints & {
      mandatory?: { chromeMediaSource?: string; chromeMediaSourceId?: string };
    };
    expect(constraints.mandatory).toEqual({ chromeMediaSource: 'tab', chromeMediaSourceId: 'stream-id' });
    expect(Object.keys(constraints)).toEqual(['mandatory']);
    await feedForDuration(state, 15);
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav' });
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('averages stereo channels for recognition analysis while retaining the original playback route', async () => {
    vi.useFakeTimers();
    const state = audioState(new Float32Array(4096).fill(0.5));
    state.right = new Float32Array(4096).fill(0.25);
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal, 12);
    await flush();
    state.process?.();
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav' });
    await vi.advanceTimersByTimeAsync(12_000);
    await result;
    expect(state.sourceConnectedToPlayback).toBe(true);
    expect(state.offlineInput?.[0]).toBeCloseTo(0.375);
    expect(state.offlineOutputRate).toBe(32_000);
  });

  it('uses the stronger channel when opposite-phase stereo would cancel the mono analysis mix', async () => {
    vi.useFakeTimers();
    const state = audioState(new Float32Array(4096).fill(0.3));
    state.right = new Float32Array(4096).fill(-0.3);
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal, 12);
    await flush();
    state.process?.();
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav' });
    await vi.advanceTimersByTimeAsync(12_000);
    await result;
    expect(state.offlineInput?.[0]).toBeCloseTo(0.3);
    expect(state.offlineInput?.some((sample) => Math.abs(sample) > 0.003)).toBe(true);
  });

  it('keeps the default diagnostic at 15 seconds and exports exactly 32 kHz 16-bit mono duration', async () => {
    vi.useFakeTimers();
    const state = audioState();
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal);
    await flush();
    await feedForDuration(state, 15);
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav', size: 960_044 });
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(state.offlineOutputLength).toBe(480_000);
    expect(state.offlineOutputRate).toBe(32_000);
    expect(state.sourceBufferRate).toBe(44_100);
  });

  it('bounds a 12-second capture to 12 seconds of source frames and a 768,044-byte WAV', async () => {
    vi.useFakeTimers();
    const state = audioState();
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal, 12);
    await flush();
    // Even an unexpectedly chatty worklet cannot grow retained audio past the requested duration.
    for (let i = 0; i < 200; i++) state.process?.();
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav', size: 768_044 });
    await vi.advanceTimersByTimeAsync(12_000);
    await result;
    expect(state.offlineInput).toHaveLength(44100 * 12);
    expect(state.offlineOutputLength).toBe(384_000);
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
    expect(state.processorPortClosed).toBe(true);
  });

  it('emits independent exact-prefix snapshots as captured frames cross each checkpoint', async () => {
    vi.useFakeTimers();
    const state = audioState(new Float32Array(4096).fill(0.25));
    stubCaptureEnvironment(state);
    const snapshots: AudioSnapshot[] = [];
    const capture = captureTabAudio('stream-id', new AbortController().signal, 12, (snapshot) => {
      snapshots.push(snapshot);
      if (snapshot.seconds === 3) snapshot.samples[0] = 0.75;
    });
    await flush();

    // Cross 3 seconds with worklet frames while the wall clock remains frozen.
    for (let i = 0; i < 33; i++) state.process?.();
    expect(snapshots.map(({ seconds }) => seconds)).toEqual([3]);
    expect(snapshots[0]?.samples).toHaveLength(44_100 * 3);
    expect(snapshots[0]?.samples[1]).toBeCloseTo(0.25);
    expect(state.workletTotalFrames).toBeGreaterThanOrEqual(44_100 * 3);

    state.input.fill(0.5);
    await feedForDuration(state, 9);
    const result = expect(capture).resolves.toMatchObject({ type: 'audio/wav', size: 768_044 });
    await result;
    expect(snapshots.map(({ seconds }) => seconds)).toEqual([3, 6, 9, 12]);
    expect(snapshots.map(({ samples }) => samples.length)).toEqual([3, 6, 9, 12].map((seconds) => 44_100 * seconds));
    expect(snapshots[0]?.samples[1]).toBeCloseTo(0.25);
    expect(snapshots[1]?.samples[0]).toBeCloseTo(0.25);
    expect(snapshots[1]?.samples.at(-1)).toBeCloseTo(0.5);
    expect(state.workletTotalFrames).toBe(44_100 * 12);
    expect(state.offlineInput?.[0]).toBeCloseTo(0.25);
    expect(state.offlineInput).toHaveLength(44_100 * 12);
  });

  it('does not emit snapshots after cancellation', async () => {
    vi.useFakeTimers();
    const state = audioState();
    stubCaptureEnvironment(state);
    const controller = new AbortController();
    const onSnapshot = vi.fn();
    const capture = captureTabAudio('stream-id', controller.signal, 12, onSnapshot);
    await flush();
    for (let i = 0; i < 33; i++) state.process?.();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(capture).rejects.toMatchObject({ name: 'AbortError' });
    state.process?.();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('skips silent progressive snapshots and still rejects the silent final capture', async () => {
    vi.useFakeTimers();
    const state = audioState(new Float32Array(4096));
    stubCaptureEnvironment(state);
    const onSnapshot = vi.fn();
    const capture = captureTabAudio('stream-id', new AbortController().signal, 12, onSnapshot);
    await flush();
    const rejected = expect(capture).rejects.toThrow(/no audible tab audio/i);
    for (let i = 0; i < 130; i++) state.process?.();
    await rejected;
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(state.workletTotalFrames).toBe(44_100 * 12);
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('rejects a silent sample and releases its stream', async () => {
    vi.useFakeTimers();
    const state = audioState(new Float32Array(4096));
    stubCaptureEnvironment(state);
    const capture = captureTabAudio('stream-id', new AbortController().signal);
    await flush();
    state.process?.();
    const rejected = expect(capture).rejects.toThrow(/no audible tab audio/i);
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(state.stopped).toBe(1);
    expect(state.closes).toBe(1);
  });

  it('encodes signed 16-bit PCM WAV samples', async () => {
    const wav = encodeWav(new Float32Array([-1, 0, 1]), 32_000);
    expect(wav.type).toBe('audio/wav');
    const bytes = await wav.arrayBuffer();
    const view = new DataView(bytes);
    const text = (start: number, length: number) => String.fromCharCode(...new Uint8Array(bytes, start, length));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(32_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe('data');
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(46, true)).toBe(0);
    expect(view.getInt16(48, true)).toBe(32767);
  });
});

function audioState(input = new Float32Array(4096).fill(0.25)): FakeAudioState {
  return {
    input,
    disconnects: 0,
    closes: 0,
    stopped: 0,
    sourceConnectedToPlayback: false,
    sourceConnectedToProcessor: false,
    processorConnectedToDestination: false,
    processorPortClosed: false,
    workletTotalFrames: 0,
  };
}

function fakeStream(state: FakeAudioState): MediaStream {
  return { getTracks: () => [{ stop: () => { state.stopped++; } }] } as unknown as MediaStream;
}

function stubCaptureEnvironment(state: FakeAudioState): void {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
    state.mediaConstraints = constraints;
    return fakeStream(state);
  }) } });
  vi.stubGlobal('AudioContext', fakeAudioContext(state));
  vi.stubGlobal('AudioWorkletNode', fakeAudioWorkletNode(state));
  vi.stubGlobal('chrome', { runtime: { getURL: (file: string) => `extension://${file}` } });
  vi.stubGlobal('OfflineAudioContext', class {
    destination = {};
    constructor(_channels: number, length: number, rate: number) {
      state.offlineOutputLength = length;
      state.offlineOutputRate = rate;
    }
    createBuffer(_channels: number, length: number, rate: number) {
      state.sourceBufferRate = rate;
      return {
        copyToChannel: (input: Float32Array) => { state.offlineInput = new Float32Array(input); },
        length,
        sampleRate: rate,
      };
    }
    createBufferSource() { return { buffer: null, connect: vi.fn(), start: vi.fn() }; }
    async startRendering() {
      const source = state.offlineInput ?? new Float32Array();
      const outputLength = state.offlineOutputLength ?? 0;
      const output = new Float32Array(outputLength);
      if (source.length && output.length) {
        for (let i = 0; i < output.length; i++) output[i] = source[Math.min(source.length - 1, Math.floor(i * source.length / output.length))]!;
      }
      return { getChannelData: () => output };
    }
  });
}

function fakeAudioContext(state: FakeAudioState): typeof AudioContext {
  return class {
    sampleRate = 44_100;
    destination = {};
    audioWorklet = { addModule: vi.fn(async (url: string) => { state.workletUrl = url; }) };
    async resume() {}
    async close() { state.closes++; }
    createMediaStreamSource(_stream: MediaStream) {
      return {
        connect: (target: unknown) => {
          if (target === this.destination) state.sourceConnectedToPlayback = true;
          else state.sourceConnectedToProcessor = true;
        },
        disconnect: () => { state.disconnects++; },
      };
    }
  } as unknown as typeof AudioContext;
}

function fakeAudioWorkletNode(state: FakeAudioState): typeof AudioWorkletNode {
  return class {
    destination: unknown;
    port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      close: () => { state.processorPortClosed = true; },
      postMessage: (message: { type: string }) => {
        if (message.type === 'stop') this.port.onmessage?.({ data: { type: 'done' } } as MessageEvent);
      },
    };
    constructor(context: AudioContext, name: string, options: AudioWorkletNodeOptions) {
      state.processorName = name;
      state.processorOptions = options;
      this.destination = context.destination;
      state.process = () => {
        const maxFrames = options.processorOptions?.maxFrames as number;
        const count = Math.min(state.input.length, maxFrames - state.workletTotalFrames);
        if (count <= 0) return;
        const right = state.right ?? state.input;
        this.port.onmessage?.({ data: { type: 'data', left: state.input.subarray(0, count), right: right.subarray(0, count) } } as MessageEvent);
        state.workletTotalFrames += count;
        if (state.workletTotalFrames >= maxFrames) {
          this.port.onmessage?.({ data: { type: 'done' } } as MessageEvent);
        }
      };
    }
    connect(target: unknown) { state.processorConnectedToDestination = target === this.destination; queueMicrotask(() => state.process?.()); }
    disconnect() { state.disconnects++; }
    onprocessorerror: ((event: Event) => void) | null = null;
  } as unknown as typeof AudioWorkletNode;
}

async function feedForDuration(state: FakeAudioState, seconds: number): Promise<void> {
  const frames = 44_100 * seconds;
  const callbacks = Math.ceil(frames / 4096);
  for (let i = 0; i < callbacks; i++) state.process?.();
  await flush();
}

async function flush(): Promise<void> { for (let i = 0; i < 10; i++) await Promise.resolve(); }
