import type { Song } from '../contracts';

const ENDPOINT = 'https://audiotag.info/api';
const MAX_WAIT_MS = 75_000;
const POLL_MS = 2_000;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function post(fields: FormData, signal: AbortSignal): Promise<Json> {
  const response = await fetch(ENDPOINT, { method: 'POST', body: fields, signal });
  if (!response.ok) throw new Error(`AudioTag request failed (HTTP ${response.status})`);
  const data: unknown = await response.json();
  if (!isRecord(data)) throw new Error('AudioTag returned an invalid response');
  return data;
}

function form(key: string, action: string): FormData {
  const data = new FormData();
  data.set('apikey', key);
  data.set('action', action);
  return data;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(done, ms);
    function done() { signal.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function parseTracks(data: unknown): Song[] {
  if (!Array.isArray(data)) return [];
  const songs: Song[] = [];
  for (const item of data) {
    if (!isRecord(item) || !Array.isArray(item.tracks)) continue;
    for (const track of item.tracks) {
      if (!Array.isArray(track)) continue;
      const [title, artist, album] = track;
      if (typeof title !== 'string' || !title.trim() || typeof artist !== 'string' || !artist.trim()) continue;
      songs.push({ title: title.trim(), artist: artist.trim(), ...(typeof album === 'string' && album.trim() ? { album: album.trim() } : {}) });
    }
  }
  return songs;
}

/** Identifies audio only when the account's remaining free allowance is known to cover it. */
export async function recognize(blob: Blob, key: string, signal: AbortSignal): Promise<Song[]> {
  if (!key.trim()) throw new Error('AudioTag API key is required');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const deadlineTimer = setTimeout(() => controller.abort(), MAX_WAIT_MS);
  const requestSignal = controller.signal;
  try {
    const stats = await post(form(key, 'stat'), requestSignal);
    if (stats.success !== true) throw new Error('AudioTag account statistics request failed; check that the API key is active');
    const freeSeconds = stats.identification_free_sec_remainder;
    if (typeof freeSeconds !== 'number' || !Number.isFinite(freeSeconds) || freeSeconds < 15) {
      throw new Error('AudioTag free allowance is unavailable or below 15 seconds; identification was not started');
    }

    const identify = form(key, 'identify');
    identify.set('file', blob, 'sample.wav');
    identify.set('time_len', '15');
    identify.set('start_time', '0');
    const started = await post(identify, requestSignal);
    if (started.success !== true || typeof started.token !== 'string' || !started.token) {
      throw new Error('AudioTag could not start identification');
    }

    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await delay(Math.min(POLL_MS, deadline - Date.now()), requestSignal);
      const poll = form(key, 'get_result');
      poll.set('token', started.token);
      const result = await post(poll, requestSignal);
      if (result.success !== true) throw new Error('AudioTag returned an invalid identification result');
      if (result.result === 'wait') continue;
      if (result.result === 'not found') return [];
      if (result.result === 'found') {
        const songs = parseTracks(result.data);
        if (songs.length === 0) throw new Error('AudioTag reported a match, but its track details could not be read.');
        return songs;
      }
      throw new Error('AudioTag returned an unknown identification status');
    }
    throw new Error('AudioTag identification timed out');
  } finally {
    clearTimeout(deadlineTimer);
    signal.removeEventListener('abort', onAbort);
  }
}
