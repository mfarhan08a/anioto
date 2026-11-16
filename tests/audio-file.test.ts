import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareAudioFile } from '../src/audio-file';

type Decoded = { duration: number; sampleRate: number; numberOfChannels: number; length: number; getChannelData: (channel: number) => Float32Array };
let decoded: Decoded;
let decode: (data: ArrayBuffer) => Promise<Decoded>;
let closeCount = 0;
let renderedLength = 0;
let contextCount = 0;

function audio(duration = 20, sampleRate = 48_000, channels = 2): Decoded {
  return {
    duration, sampleRate, numberOfChannels: channels, length: Math.floor(duration * sampleRate),
    getChannelData: () => new Float32Array(Math.floor(duration * sampleRate)).fill(0.2),
  };
}

class MockAudioContext {
  state = 'running';
  constructor() { contextCount++; closeCount = 0; }
  async decodeAudioData(data: ArrayBuffer): Promise<Decoded> { return decode(data); }
  async close(): Promise<void> { closeCount++; this.state = 'closed'; }
}

class MockOfflineAudioContext {
  constructor(_channels: number, length: number, _rate: number) { renderedLength = length; }
  createBuffer(_channels: number, length: number) {
    const values = new Float32Array(length);
    return { copyToChannel: (samples: Float32Array) => values.set(samples), getChannelData: () => values };
  }
  createBufferSource() { return { buffer: null, connect: () => undefined, start: () => undefined }; }
  get destination() { return {}; }
  async startRendering() { return { getChannelData: () => new Float32Array(renderedLength).fill(0.2) }; }
}

function setDecoded(value = audio()): void { decoded = value; decode = async () => decoded; }
function makeFile(size = 64): File { return new File([new Uint8Array(size)], 'audio.mp3', { type: 'text/plain' }); }

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('prepareAudioFile', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('decodes actual file bytes, crops to the selected sample duration, mixes and returns WAV', async () => {
    setDecoded(audio(40));
    const decodeSpy = vi.fn(async (data: ArrayBuffer) => { expect(data.byteLength).toBe(64); return decoded; });
    decode = decodeSpy;
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);

    const result = await prepareAudioFile(makeFile(), 12, new AbortController().signal);
    expect(decodeSpy).toHaveBeenCalledOnce();
    expect(renderedLength).toBe(Math.ceil(12 * 48_000 * 32_000 / 48_000));
    expect(result.type).toBe('audio/wav');
    expect(closeCount).toBe(1);
  });

  it('allows a five-second local-helper sample and requires the full AudioTag sample', async () => {
    setDecoded(audio(5));
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);
    await expect(prepareAudioFile(makeFile(), 12, new AbortController().signal)).resolves.toMatchObject({ type: 'audio/wav' });
    await expect(prepareAudioFile(makeFile(), 15, new AbortController().signal)).rejects.toThrow('at least 15 seconds');
  });

  it('rejects empty and over-10-MB files before decoding', async () => {
    setDecoded();
    contextCount = 0;
    vi.stubGlobal('AudioContext', MockAudioContext);
    await expect(prepareAudioFile(makeFile(0), 12, new AbortController().signal)).rejects.toThrow('non-empty');
    await expect(prepareAudioFile(makeFile(10 * 1024 * 1024 + 1), 12, new AbortController().signal)).rejects.toThrow('10 MB');
    expect(contextCount).toBe(0);
  });

  it.each([
    ['too long', audio(60.1), 'no more than 60 seconds'],
    ['too short', audio(4.99), 'at least 5 seconds'],
    ['too many channels', audio(20, 48_000, 3), 'one or two channels'],
    ['invalid sample rate', audio(20, 7_999, 1), 'sample rate'],
    ['invalid duration', audio(Number.NaN), 'duration'],
  ])('rejects decoded audio with %s and still closes the decoder', async (_label, value, message) => {
    setDecoded(value);
    vi.stubGlobal('AudioContext', MockAudioContext);
    await expect(prepareAudioFile(makeFile(), 12, new AbortController().signal)).rejects.toThrow(message);
    expect(closeCount).toBe(1);
  });

  it('rejects content the browser decoder cannot read and closes the decoder', async () => {
    decode = async () => { throw new Error('decode failure'); };
    vi.stubGlobal('AudioContext', MockAudioContext);
    await expect(prepareAudioFile(makeFile(), 12, new AbortController().signal)).rejects.toThrow('could not be decoded as audio');
    expect(closeCount).toBe(1);
  });

  it('checks cancellation before decoding and after a decode that cannot be interrupted', async () => {
    const controller = new AbortController();
    let finishDecode!: (value: Decoded) => void;
    decode = () => new Promise((resolve) => { finishDecode = resolve; });
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);
    const pending = prepareAudioFile(makeFile(), 12, controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(finishDecode).toBeTypeOf('function'));
    controller.abort();
    finishDecode(audio());
    await assertion;
    expect(closeCount).toBe(1);
  });
});
