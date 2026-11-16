import { mixStereoForAnalysis, resampleMonoToWav } from './capture';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_SECONDS = 60;
const MIN_SAMPLE_RATE = 8_000;
const MAX_SAMPLE_RATE = 192_000;

function abortError(): DOMException { return new DOMException('Audio preparation cancelled.', 'AbortError'); }
function checkAbort(signal: AbortSignal): void { if (signal.aborted) throw abortError(); }

/** Decode and normalize a selected audio file for a single explicitly requested recognition. */
export async function prepareAudioFile(file: File, seconds: 12 | 15, signal: AbortSignal): Promise<Blob> {
  checkAbort(signal);
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('Choose a non-empty audio file.');
  if (file.size > MAX_BYTES) throw new Error('Audio files must be 10 MB or smaller.');
  if (seconds !== 12 && seconds !== 15) throw new Error('Unsupported audio sample length.');

  let context: AudioContext | undefined;
  try {
    checkAbort(signal);
    context = new AudioContext();
    const bytes = await file.arrayBuffer();
    checkAbort(signal);
    let decoded: AudioBuffer;
    try { decoded = await context.decodeAudioData(bytes); }
    catch {
      checkAbort(signal);
      throw new Error('This file could not be decoded as audio. Choose a supported audio file.');
    }
    checkAbort(signal);

    const duration = decoded.duration;
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
      throw new Error('Audio duration must be longer than 0 and no more than 60 seconds.');
    }
    if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
      throw new Error('Audio must have one or two channels.');
    }
    if (!Number.isFinite(decoded.sampleRate) || decoded.sampleRate < MIN_SAMPLE_RATE || decoded.sampleRate > MAX_SAMPLE_RATE) {
      throw new Error('Audio sample rate must be between 8 kHz and 192 kHz.');
    }
    const minimum = seconds === 12 ? 5 : 15;
    if (duration < minimum) throw new Error(`Audio must be at least ${minimum} seconds long for this recognizer.`);

    const frames = Math.min(decoded.length, Math.floor(Math.min(duration, seconds) * decoded.sampleRate));
    if (frames <= 0) throw new Error('The selected audio has no usable samples.');
    const left = decoded.getChannelData(0).subarray(0, frames);
    const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1).subarray(0, frames) : left;
    const mono = mixStereoForAnalysis(left, right, frames);
    checkAbort(signal);
    const wav = await resampleMonoToWav(mono, decoded.sampleRate);
    checkAbort(signal);
    return wav;
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => undefined);
  }
}
