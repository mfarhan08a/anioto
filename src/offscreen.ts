import { captureTabAudio } from './capture';
import { resolveAnime } from './providers/anime';
import { recognize } from './providers/audiotag';
import { recognizeProgressive } from './providers/progressive-shazam';
import type { Job, RecognitionProvider, Result, Song } from './contracts';
import { isLocalRecognitionProvider, isSong } from './contracts';

interface ActiveJob { controller: AbortController; }
const jobs = new Map<string, ActiveJob>();
const PREVIEW_TTL_MS = 120_000;
let previewUrl: string | undefined;
let previewTimer: ReturnType<typeof setTimeout> | undefined;

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const message = raw as { target?: string; type?: string; id?: string; streamId?: string; apiKey?: string; provider?: RecognitionProvider; song?: Song };
  if (message.target !== 'offscreen' || !message.id) return;
  if (message.type === 'OFFSCREEN_CANCEL') {
    jobs.get(message.id)?.controller.abort();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === 'OFFSCREEN_STATUS') {
    sendResponse({ running: jobs.has(message.id) });
    return;
  }
  if (message.type === 'OFFSCREEN_START' && message.streamId) {
    const provider = message.provider ?? 'audiotag';
    if (isLocalRecognitionProvider(provider) || (provider === 'audiotag' && typeof message.apiKey === 'string')) {
      sendResponse({ ok: true });
      void runCapture(message.id, message.streamId, provider, message.apiKey);
      return;
    }
  }
  if (message.type === 'OFFSCREEN_TEST_CAPTURE' && message.streamId) {
    sendResponse({ ok: true });
    void runCaptureTest(message.id, message.streamId);
    return;
  }
  if (message.type === 'OFFSCREEN_LOOKUP' && isSong(message.song)) {
    sendResponse({ ok: true });
    void runLookup(message.id, message.song);
    return;
  }
});

async function runCapture(id: string, streamId: string, provider: RecognitionProvider, apiKey?: string): Promise<void> {
  const controller = register(id);
  try {
    const providerName = provider === 'songrec' ? 'SongRec' : provider === 'local-shazam' ? 'Local Shazam' : 'AudioTag';
    let songs: Song[];
    if (isLocalRecognitionProvider(provider)) {
      const phaseStartedAt = Date.now();
      await update(id, 'listening and recognizing', 'Listening now. First song check after 3 seconds; longer samples only if needed. Playback continues.', undefined, undefined, 12, phaseStartedAt);
      songs = await recognizeProgressive(streamId, controller.signal, async event => {
        if (controller.signal.aborted) return;
        const message = event.phase === 'recognizing'
          ? `Checking the ${event.sampleSeconds}-second sample${event.capturing ? ' while listening continues' : ''}. Stops automatically when a song matches.`
          : event.sampleSeconds === undefined
            ? 'Listening now. First song check after 3 seconds; longer samples only if needed.'
            : event.capturing
              ? `No song matched the ${event.sampleSeconds}-second sample yet. Listening for a longer sample.`
              : 'Recording finished. Waiting for the remaining song checks.';
        await update(id, 'listening and recognizing', message, undefined, undefined, 12, phaseStartedAt);
      }, provider);
    } else {
      await update(id, 'capturing', 'Listening to the selected tab for 15 seconds. Playback continues through your speakers.', undefined, undefined, 15);
      const blob = await captureTabAudio(streamId, controller.signal, 15);
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      await update(id, 'submitting', 'Audio captured. Sending the short sample to AudioTag for recognition.');
      songs = await recognize(blob, apiKey ?? '', controller.signal);
    }
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const uniqueSongs = [...new Map(songs.filter(isSong).map((song) => [songIdentity(song), song])).values()];
    if (!uniqueSongs.length) {
      await update(id, 'no song', isLocalRecognitionProvider(provider)
        ? `${providerName} found no song after checking the available samples up to 12 seconds. Try a clear music section or search manually.`
        : 'AudioTag returned no match for this 15-second sample. Try a clear music section with minimal dialogue, or search the song manually.');
      return;
    }
    if (uniqueSongs.length > 1) {
      const candidates = uniqueSongs.slice(0, 5).map((song) => `${song.title} — ${song.artist}`).join('; ');
      await update(id, 'ambiguous', `${providerName} returned multiple possible songs: ${candidates}. Use manual song lookup to choose one.`);
      return;
    }
    await resolveAndFinish(id, uniqueSongs[0]!, controller.signal);
  } catch (error) {
    if (controller.signal.aborted || isAbort(error)) await update(id, 'cancelled', 'Identification cancelled.');
    else await update(id, 'failed', errorMessage(error));
  } finally {
    jobs.delete(id);
  }
}

async function runCaptureTest(id: string, streamId: string): Promise<void> {
  const controller = register(id);
  try {
    await update(id, 'capturing', 'Capturing 15 seconds locally. This sample will not be uploaded.');
    const blob = await captureTabAudio(streamId, controller.signal);
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    revokePreview();
    const url = URL.createObjectURL(blob);
    previewUrl = url;
    await update(id, 'sample-ready', 'Local recording ready. Play it to check what was captured. Nothing was uploaded.', undefined, url);
    previewTimer = setTimeout(() => {
      if (previewUrl !== url) return;
      revokePreview();
      void update(id, 'sample-expired', 'The local diagnostic sample expired. Run the capture check again.', undefined);
    }, PREVIEW_TTL_MS);
  } catch (error) {
    revokePreview();
    if (controller.signal.aborted || isAbort(error)) await update(id, 'cancelled', 'Local capture cancelled. No audio was uploaded.');
    else await update(id, 'failed', errorMessage(error));
  } finally {
    jobs.delete(id);
  }
}

async function runLookup(id: string, song: Song): Promise<void> {
  const controller = register(id);
  try {
    await resolveAndFinish(id, song, controller.signal, true);
  } catch (error) {
    if (controller.signal.aborted || isAbort(error)) await update(id, 'cancelled', 'Search cancelled.');
    else await update(id, 'failed', errorMessage(error));
  } finally {
    jobs.delete(id);
  }
}

async function resolveAndFinish(id: string, song: Song, signal: AbortSignal, manual = false): Promise<void> {
  await update(id, 'resolving anime', 'Searching anime song credits, alternate versions, and possible cover connections.', { song, anime: [] });
  let anime: Result['anime'];
  try {
    const lookupStartedAt = Date.now();
    anime = await resolveAnime(song, signal, async (matches) => {
      if (!signal.aborted) await update(id, 'resolving anime', matches.every(match => match.matchKind === 'possible') ? 'Possible anime connections found. Loading optional artwork.' : 'Anime connection found. Loading optional artwork.', { song, anime: matches }, undefined, undefined, lookupStartedAt);
    });
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    await update(id, 'song-only', `${manual ? 'Song lookup' : 'Song recognized'}; anime lookup unavailable. ${errorMessage(error)}`, { song, anime: [] });
    return;
  }
  const result: Result = { song, anime };
  const possibleOnly = anime.length > 0 && anime.every(match => match.matchKind === 'possible');
  const message = possibleOnly ? 'Possible anime connections found. Check the source credits; the recording performer is not confirmed.' : manual
    ? (anime.length ? 'Anime associations found for the supplied song.' : 'No documented anime connection found for the supplied song after checking song credits and alternate versions.')
    : (anime.length ? 'Song and anime associations found.' : 'Song identified; no documented anime connection found after checking song credits and alternate versions.');
  await update(id, anime.length ? 'complete' : 'song-only', message, result);
}

function register(id: string): AbortController {
  revokePreview();
  jobs.get(id)?.controller.abort();
  const controller = new AbortController();
  jobs.set(id, { controller });
  return controller;
}

async function update(id: string, stage: string, message: string, result?: Result, sampleUrl?: string, captureSeconds?: number, stageStartedAt = Date.now()): Promise<void> {
  const job: Job = {
    id, stage, message, stageStartedAt,
    ...(captureSeconds ? { captureSeconds } : {}),
    ...(result ? { result } : {}),
    ...(sampleUrl ? { previewUrl: sampleUrl } : {})
  };
  await chrome.runtime.sendMessage({ target: 'background', type: 'JOB_UPDATE', job }).catch(() => undefined);
}

function revokePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = undefined;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
}

function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'The request failed unexpectedly.'; }
function songIdentity(song: Song): string { return `${song.title.trim().toLocaleLowerCase()}\u0000${song.artist.trim().toLocaleLowerCase()}`; }
