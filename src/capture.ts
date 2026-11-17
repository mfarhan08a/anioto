const SAMPLE_SECONDS = 15;
const SILENCE_RMS = 0.003;
const OUTPUT_SAMPLE_RATE = 32_000;
const MEDIA_ACQUISITION_TIMEOUT_MS = 8_000;
const AUDIO_SETUP_TIMEOUT_MS = 8_000;
const WORKLET_FLUSH_TIMEOUT_MS = 500;

export interface AudioSnapshot {
  samples: Float32Array;
  sampleRate: number;
  seconds: 3 | 6 | 9 | 12;
}

const SNAPSHOT_SECONDS = [3, 6, 9, 12] as const;

export async function captureTabAudio(
  streamId: string,
  signal: AbortSignal,
  sampleSeconds: 8 | 12 | 15 = SAMPLE_SECONDS,
  onSnapshot?: (snapshot: AudioSnapshot) => void
): Promise<Blob> {
  if (signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
  const stream = await acquireTabStream(streamId, signal);
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: AudioWorkletNode | undefined;
  const chunks: Float32Array[] = [];
  let capturedFrames = 0;
  let maxFrames = 0;
  let rmsSum = 0;
  let rmsWindows = 0;
  let stopped = false;
  let captureFailure: Error | undefined;
  let finishCapture: (() => void) | undefined;
  let nextSnapshot = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (processor) {
      processor.port.onmessage = null;
      processor.onprocessorerror = null;
      processor.port.close();
    }
    processor?.disconnect();
    source?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    if (context) void context.close();
  };

  try {
    if (signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
    context = new AudioContext();
    const audioContext = context;
    maxFrames = Math.ceil(audioContext.sampleRate * sampleSeconds);
    await awaitUnlessAborted(
      audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-capture-worklet.js')),
      signal,
      'Timed out while loading the audio capture worklet.'
    );
    source = audioContext.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(audioContext, 'anime-song-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { maxFrames }
    });
    const audioProcessor = processor;
    audioProcessor.port.onmessage = (event: MessageEvent<{ type: string; left?: Float32Array; right?: Float32Array; message?: string }>) => {
      if (stopped || signal.aborted) return;
      if (event.data.type === 'error') {
        captureFailure ??= new Error(event.data.message || 'Audio capture worklet failed.');
        finishCapture?.();
        return;
      }
      if (event.data.type === 'data' && event.data.left && event.data.right) {
        const frameCount = Math.min(event.data.left.length, event.data.right.length, maxFrames - capturedFrames);
        if (frameCount > 0) {
          const data = mixStereoForAnalysis(event.data.left, event.data.right, frameCount);
          chunks.push(data);
          capturedFrames += frameCount;
          let power = 0;
          for (const sample of data) power += sample * sample;
          rmsSum += Math.sqrt(power / Math.max(1, data.length));
          rmsWindows++;
          if (onSnapshot) {
            while (nextSnapshot < SNAPSHOT_SECONDS.length) {
              const seconds = SNAPSHOT_SECONDS[nextSnapshot]!;
              const checkpointFrames = Math.round(audioContext.sampleRate * seconds);
              if (capturedFrames < checkpointFrames) break;
              const samples = copyPrefix(chunks, checkpointFrames);
              if (rootMeanSquare(samples) >= SILENCE_RMS) {
                try {
                  onSnapshot({ samples, sampleRate: audioContext.sampleRate, seconds });
                } catch (error) {
                  captureFailure ??= error instanceof Error ? error : new Error('Audio snapshot callback failed.');
                  finishCapture?.();
                  return;
                }
              }
              nextSnapshot++;
              if (signal.aborted || stopped) return;
            }
          }
        }
      }
      if (event.data.type === 'done') finishCapture?.();
    };
    audioProcessor.onprocessorerror = () => {
      captureFailure ??= new Error('Audio capture worklet stopped unexpectedly.');
      finishCapture?.();
    };
    await awaitUnlessAborted(audioContext.resume(), signal, 'Timed out while starting audio capture.');
    // Keep playback on the untouched stereo path while analysis uses a mono mix.
    source.connect(audioContext.destination);
    source.connect(processor);
    processor.connect(context.destination);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort);
        if (flushTimer) clearTimeout(flushTimer);
        if (deadlineTimer) clearTimeout(deadlineTimer);
        finishCapture = undefined;
      };
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      finishCapture = () => settle(captureFailure);
      const onAbort = () => settle(new DOMException('Capture cancelled', 'AbortError'));
      flushTimer = setTimeout(() => {
        audioProcessor.port.postMessage({ type: 'stop' });
        deadlineTimer = setTimeout(
          () => settle(captureFailure ?? new Error('Timed out waiting for the audio capture worklet to flush.')),
          WORKLET_FLUSH_TIMEOUT_MS
        );
      }, sampleSeconds * 1000);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    stop();
    if (chunks.length === 0 || rmsSum / rmsWindows < SILENCE_RMS) {
      throw new Error('No audible tab audio was detected.');
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const input = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }

    return await resampleMonoToWav(input, audioContext.sampleRate);
  } finally {
    stop();
  }

}

function copyPrefix(chunks: Float32Array[], length: number): Float32Array {
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    const count = Math.min(chunk.length, length - offset);
    if (count <= 0) break;
    samples.set(chunk.subarray(0, count), offset);
    offset += count;
  }
  return samples;
}

function rootMeanSquare(samples: Float32Array): number {
  let power = 0;
  for (const sample of samples) power += sample * sample;
  return Math.sqrt(power / Math.max(1, samples.length));
}

async function acquireTabStream(streamId: string, signal: AbortSignal): Promise<MediaStream> {
  // Chromium's tab-source selector uses the legacy constraint format. Mixing
  // standard audio constraints into it makes getUserMedia reject the request.
  const pending = navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as MediaTrackConstraints,
    video: false
  });
  let acquired: MediaStream | undefined;
  void pending.then((stream) => {
    acquired = stream;
    if (settled) stream.getTracks().forEach((track) => track.stop());
  }, () => undefined);

  let settled = false;
  try {
    return await new Promise<MediaStream>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const onAbort = () => finish(() => reject(new DOMException('Capture cancelled', 'AbortError')));
      const timer = setTimeout(() => finish(() => reject(new Error('Timed out while acquiring tab audio.'))), MEDIA_ACQUISITION_TIMEOUT_MS);
      signal.addEventListener('abort', onAbort, { once: true });
      pending.then(
        (stream) => finish(() => resolve(stream)),
        (error: unknown) => finish(() => reject(error))
      );
      if (signal.aborted) onAbort();
    });
  } catch (error) {
    acquired?.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

function awaitUnlessAborted<T>(operation: Promise<T>, signal: AbortSignal, timeoutMessage: string): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Capture cancelled', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, AUDIO_SETUP_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Capture cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(
      (value) => { cleanup(); resolve(value); },
      (error: unknown) => { cleanup(); reject(error); }
    );
    if (signal.aborted) onAbort();
  });
}

export function mixStereoForAnalysis(left: Float32Array, right: Float32Array, frameCount = Math.min(left.length, right.length)): Float32Array {
  const length = Math.max(0, Math.min(frameCount, left.length, right.length));
  const mixed = new Float32Array(length);
  let leftPower = 0;
  let rightPower = 0;
  let mixedPower = 0;
  for (let i = 0; i < length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    const average = (l + r) * 0.5;
    mixed[i] = average;
    leftPower += l * l;
    rightPower += r * r;
    mixedPower += average * average;
  }
  const strongerPower = Math.max(leftPower, rightPower);
  if (strongerPower > 0 && mixedPower < strongerPower * 0.1) {
    const strongerChannel = rightPower > leftPower ? right : left;
    for (let i = 0; i < length; i++) mixed[i] = strongerChannel[i]!;
  }
  return mixed;
}

export async function resampleMonoToWav(samples: Float32Array, sourceRate: number): Promise<Blob> {
  const outputLength = Math.ceil(samples.length * OUTPUT_SAMPLE_RATE / sourceRate);
  const offline = new OfflineAudioContext(1, outputLength, OUTPUT_SAMPLE_RATE);
  const buffer = offline.createBuffer(1, samples.length, sourceRate);
  buffer.copyToChannel(new Float32Array(samples), 0);
  const resampler = offline.createBufferSource();
  resampler.buffer = buffer;
  resampler.connect(offline.destination);
  resampler.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), OUTPUT_SAMPLE_RATE);
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}
