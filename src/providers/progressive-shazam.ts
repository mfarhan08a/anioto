import type { LocalRecognitionProvider, Song } from '../contracts';
import { captureTabAudio, resampleMonoToWav, type AudioSnapshot } from '../capture';
import { recognizeLocal } from './local-shazam';

const OVERALL_TIMEOUT_MS = 65_000;
const SNAPSHOT_SECONDS = [3, 6, 9, 12] as const;
const STOPPED = new DOMException('Recognition stopped', 'AbortError');

export interface ProgressiveProgress {
  phase: 'listening' | 'recognizing';
  sampleSeconds?: 3 | 6 | 9 | 12;
  capturing: boolean;
}

/** Recognizes cumulative audio prefixes while capture continues in the background. */
export function recognizeProgressive(
  streamId: string,
  signal: AbortSignal,
  onProgress?: (event: ProgressiveProgress) => void | Promise<void>,
  provider: LocalRecognitionProvider = 'local-shazam',
): Promise<Song[]> {
  if (signal.aborted) return Promise.reject(new DOMException('Recognition cancelled', 'AbortError'));

  return new Promise<Song[]>((resolve, reject) => {
    const captureController = new AbortController();
    let ended = false;
    let captureDone = false;
    let workerRunning = false;
    let pending: AudioSnapshot | undefined;
    let requestCount = 0;
    let lastSampleSeconds: AudioSnapshot['seconds'] | undefined;
    const requested = new Set<number>();
    let rejectStop!: (error: Error) => void;
    const stopped = new Promise<never>((_resolve, rejectStopped) => { rejectStop = rejectStopped; });
    // The stop promise is raced by in-flight conversion/recognition work. Observe it even before
    // the first snapshot arrives so cancellation cannot create an unhandled rejection.
    void stopped.catch(() => undefined);

    const abortError = () => new DOMException('Recognition cancelled', 'AbortError');
    const finish = (songs?: Song[], error?: Error) => {
      if (ended) return;
      ended = true;
      clearTimeout(overallTimer);
      signal.removeEventListener('abort', onCallerAbort);
      captureController.abort();
      rejectStop(error ?? STOPPED);
      if (error) reject(error);
      else resolve(songs ?? []);
    };
    const onCallerAbort = () => finish(undefined, abortError());
    const name = provider === 'songrec' ? 'SongRec' : 'Shazam';
    const overallTimer = setTimeout(() => finish(undefined, new Error(`Progressive ${name} recognition timed out.`)), OVERALL_TIMEOUT_MS);
    signal.addEventListener('abort', onCallerAbort, { once: true });
    if (signal.aborted) {
      onCallerAbort();
      return;
    }

    const publish = (event: ProgressiveProgress) => {
      if (ended || !onProgress) return;
      // Never wait for UI progress work. Catch both synchronous throws and async rejections.
      try {
        const result = onProgress(event);
        if (result && typeof result.then === 'function') void result.catch(() => undefined);
      } catch { /* Progress reporting must not interrupt recognition. */ }
    };

    const fail = (error: unknown) => {
      if (ended) return;
      if (signal.aborted) finish(undefined, abortError());
      else finish(undefined, error instanceof Error ? error : new Error(`Progressive ${name} recognition failed.`));
    };

    const pump = () => {
      if (ended || workerRunning) return;
      if (!pending) {
        if (captureDone) finish([]);
        return;
      }

      const snapshot = pending;
      pending = undefined;
      if (requested.has(snapshot.seconds) || requestCount >= SNAPSHOT_SECONDS.length) {
        pump();
        return;
      }
      requested.add(snapshot.seconds);
      requestCount++;
      lastSampleSeconds = snapshot.seconds;
      workerRunning = true;
      publish({ phase: 'recognizing', sampleSeconds: snapshot.seconds, capturing: !captureDone });
      void processSnapshot(snapshot).then((songs) => {
        if (ended) return;
        workerRunning = false;
        if (songs.length > 0) {
          finish(uniqueSongs(songs));
          return;
        }
        if (!pending && !captureDone) publish({ phase: 'listening', sampleSeconds: snapshot.seconds, capturing: true });
        pump();
      }, fail);
    };

    const processSnapshot = async (snapshot: AudioSnapshot): Promise<Song[]> => {
      const wav = await Promise.race([
        resampleMonoToWav(snapshot.samples, snapshot.sampleRate),
        stopped
      ]);
      if (ended) return [];
      return await Promise.race([recognizeLocal(wav, captureController.signal, provider), stopped]);
    };

    publish({ phase: 'listening', capturing: true });
    let capture: Promise<Blob>;
    try {
      capture = captureTabAudio(streamId, captureController.signal, 12, (snapshot) => {
        if (ended || captureController.signal.aborted) return;
        if (!(SNAPSHOT_SECONDS as readonly number[]).includes(snapshot.seconds) || requested.has(snapshot.seconds)) return;
        pending = snapshot;
        pump();
      });
    } catch (error) {
      fail(error);
      return;
    }
    // Capture completion's WAV is intentionally unused; observing both branches also prevents
    // rejection noise after an early match or caller cancellation.
    void capture.then(() => {
      if (ended) return;
      captureDone = true;
      publish({ phase: 'listening', ...(lastSampleSeconds === undefined ? {} : { sampleSeconds: lastSampleSeconds }), capturing: false });
      pump();
    }, (error: unknown) => {
      if (ended && captureController.signal.aborted) return;
      fail(error);
    });
  });
}

function uniqueSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = `${song.title.trim().toLocaleLowerCase()}\u0000${song.artist.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
