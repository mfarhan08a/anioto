import type { LocalRecognitionProvider, Song } from '../contracts';

const ENDPOINT = 'http://127.0.0.1:18742/recognize';
const TIMEOUT_MS = 45_000;
const MAX_SONGS = 10;
const MAX_FIELD_LENGTH = 200;
type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_FIELD_LENGTH;
}

/** Sends a captured WAV only to the explicitly selected local helper. */
export async function recognizeLocal(blob: Blob, signal: AbortSignal, provider: LocalRecognitionProvider = 'local-shazam'): Promise<Song[]> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const name = provider === 'songrec' ? 'Local SongRec helper' : 'Local Shazam helper';
  const endpoint = provider === 'songrec' ? `${ENDPOINT}/songrec` : ENDPOINT;
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  signal.addEventListener('abort', relayAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'audio/wav', 'X-Anime-Song-Finder': '1' },
        body: blob,
        signal: controller.signal,
      });
    } catch (error) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (controller.signal.aborted) throw new Error(`${name} request timed out.`);
      if (error instanceof TypeError) throw new Error(`${name} is not running or did not allow this extension origin. Start the helper and try again.`);
      throw new Error(`Could not reach the ${name.toLowerCase()}.`);
    }

    let payload: unknown;
    try { payload = await response.json(); }
    catch {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (controller.signal.aborted) throw new Error(`${name} request timed out.`);
      throw new Error(`${name} returned an invalid response.`);
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new Error(`${name} request timed out.`);
    if (isRecord(payload) && typeof payload.error === 'string') {
      const detail = payload.error.trim().slice(0, MAX_FIELD_LENGTH);
      throw new Error(detail ? `${name}: ${detail === 'Not found.' && provider === 'songrec' ? 'Restart the local helper to load SongRec support.' : detail}` : `${name} returned an error.`);
    }
    if (!response.ok) {
      throw new Error(`${name} request failed (HTTP ${response.status}).`);
    }
    if (!isRecord(payload) || !Array.isArray(payload.songs) || payload.songs.length > MAX_SONGS) {
      throw new Error(`${name} returned an invalid response; expected up to ${MAX_SONGS} songs.`);
    }
    if (payload.songs.length === 0) return [];

    const songs: Song[] = [];
    for (const value of payload.songs) {
      if (!isRecord(value) || !validText(value.title) || !validText(value.artist) ||
        (value.album !== undefined && (typeof value.album !== 'string' || value.album.trim().length > MAX_FIELD_LENGTH))) {
        throw new Error(`${name} returned invalid song details.`);
      }
      songs.push({
        title: value.title.trim(),
        artist: value.artist.trim(),
        ...(typeof value.album === 'string' && value.album.trim() ? { album: value.album.trim() } : {}),
      });
    }
    return songs;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', relayAbort);
  }
}
