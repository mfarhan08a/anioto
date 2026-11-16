import type { AnimeMatch, Song } from './contracts';
import { isLocalRecognitionProvider } from './contracts';
import { prepareAudioFile } from './audio-file';
import { recognizeLocal } from './providers/local-shazam';
import { recognize } from './providers/audiotag';
import { resolveAnime } from './providers/anime';
import { createAnimeTitleDisplay } from './anime-title';

type BrowserApi = typeof chrome;
const api = (globalThis as typeof globalThis & { browser?: BrowserApi }).browser ?? globalThis.chrome;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileForm = get<HTMLFormElement>('audio-form');
const manualForm = get<HTMLFormElement>('manual-form');
const provider = get<HTMLSelectElement>('provider');
const keyInput = get<HTMLInputElement>('api-key');
const fileInput = get<HTMLInputElement>('audio-file');
const consentInput = get<HTMLInputElement>('consent');
const consentNote = get('consent-note');
const activity = get('activity');
const statusText = get('status');
const idleStatus = get('idle-status');
const elapsedText = get('elapsed');
const result = get('result');
const progress = get<HTMLProgressElement>('progress');
const cancelButton = get<HTMLButtonElement>('cancel');

let active: AbortController | undefined;
let activeId = 0;
let startedAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const pageLifecycle = new AbortController();

try { get('extension-origin').textContent = api.runtime.getURL('').replace(/\/$/, ''); }
catch { get('extension-origin').textContent = 'Could not read this extension’s origin.'; }

function updateProvider(): void {
  const audioTag = provider.value === 'audiotag';
  keyInput.disabled = !audioTag || Boolean(active);
  keyInput.required = audioTag;
  const seconds = audioTag ? 15 : 12;
  consentNote.textContent = audioTag
    ? `The first ${seconds} seconds will be processed and sent to AudioTag for recognition. AudioTag is an online service; files must contain at least 15 seconds.`
    : `Up to the first ${seconds} seconds will be processed by ${provider.value === 'songrec' ? 'SongRec' : 'ShazamIO'} through the local helper. The helper queries Shazam online; files must contain at least 5 seconds.`;
  consentInput.checked = false;
}

function formsDisabled(disabled: boolean): void {
  for (const control of Array.from(document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('#audio-form button, #audio-form input, #audio-form select, #manual-form button, #manual-form input'))) {
    control.disabled = disabled;
  }
  if (!disabled) updateProvider();
  cancelButton.disabled = !disabled;
}

function setElapsed(frozen?: number): void {
  const seconds = frozen ?? Math.floor((Date.now() - startedAt) / 1000);
  elapsedText.textContent = `Elapsed: ${seconds} second${seconds === 1 ? '' : 's'}`;
}

function begin(label: string): { controller: AbortController; id: number } {
  active?.abort();
  const controller = new AbortController();
  active = controller;
  const id = ++activeId;
  startedAt = Date.now();
  result.replaceChildren();
  idleStatus.hidden = true;
  activity.hidden = false;
  progress.hidden = false;
  progress.removeAttribute('value');
  statusText.textContent = label;
  elapsedText.hidden = false;
  setElapsed();
  if (timer) clearInterval(timer);
  timer = setInterval(() => { if (id === activeId) setElapsed(); }, 1000);
  formsDisabled(true);
  return { controller, id };
}

function end(id: number, message: string): void {
  if (id !== activeId) return;
  active = undefined;
  statusText.textContent = message;
  progress.hidden = true;
  if (timer) clearInterval(timer);
  timer = undefined;
  setElapsed();
  formsDisabled(false);
}

function safeHttps(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; }
  catch { return undefined; }
}

function renderSong(song: Song): HTMLElement {
  const card = document.createElement('article');
  const title = document.createElement('h2');
  title.textContent = song.title;
  const artist = document.createElement('p');
  artist.textContent = song.artist;
  card.append(title, artist);
  if (song.album) {
    const album = document.createElement('p');
    album.textContent = song.album;
    card.append(album);
  }
  return card;
}

function renderMatches(matches: AnimeMatch[]): void {
  for (const match of matches) {
    const card = document.createElement('article');
    const cover = safeHttps(match.coverUrl);
    if (cover) {
      const image = document.createElement('img');
      image.src = cover;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => image.remove();
      card.append(image);
    }
    const evidence = document.createElement('p');
    const label = match.matchKind === 'possible' ? 'Possible match'
      : match.matchKind === 'version' ? 'Version match'
        : match.matchKind === 'confirmed' ? 'Confirmed match' : '';
    evidence.textContent = [label, match.type, match.evidence].filter(Boolean).join(' · ');
    card.append(createAnimeTitleDisplay(match, 'h3'), evidence);
    const links: Array<[string, string | undefined]> = [
      ['View source', safeHttps(match.sourceUrl)],
      ['Recording reference', safeHttps(match.recordingReferenceUrl)],
    ];
    for (const [text, href] of links) {
      if (!href) continue;
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = text;
      card.append(link);
    }
    result.append(card);
  }
}

async function resolve(song: Song, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  result.replaceChildren(renderSong(song));
  let found = false;
  const matches = await resolveAnime(song, signal, (items) => {
    if (signal.aborted) return;
    found = items.length > 0;
    result.replaceChildren(renderSong(song));
    renderMatches(items);
  });
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  result.replaceChildren(renderSong(song));
  renderMatches(matches);
  if (!found && matches.length === 0) {
    const noMatch = document.createElement('p');
    noMatch.textContent = 'No documented anime connection was found for this song.';
    result.append(noMatch);
  }
}

async function run(label: string, task: (signal: AbortSignal) => Promise<string>): Promise<void> {
  const { controller, id } = begin(label);
  let terminalMessage = 'Search complete.';
  try { terminalMessage = await task(controller.signal); }
  catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) terminalMessage = 'Search cancelled.';
    else terminalMessage = error instanceof Error ? error.message : 'The search failed unexpectedly.';
  } finally {
    end(id, terminalMessage);
  }
}

fileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  if (!file) { idleStatus.textContent = 'Choose an audio file to continue.'; idleStatus.hidden = false; return; }
  if (!consentInput.checked) { idleStatus.textContent = 'Confirm that you understand the selected clip will be sent to the recognition service.'; idleStatus.hidden = false; return; }
  const selectedProvider = provider.value;
  const key = keyInput.value;
  if (selectedProvider === 'audiotag' && !key.trim()) { idleStatus.textContent = 'Enter an AudioTag API key to continue.'; idleStatus.hidden = false; return; }
  void run('Preparing selected audio…', async (signal) => {
    const seconds = selectedProvider === 'audiotag' ? 15 : 12;
    const sample = await prepareAudioFile(file, seconds, signal);
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    statusText.textContent = selectedProvider === 'audiotag'
      ? 'Audio prepared. Sending the 15-second sample to AudioTag for recognition…'
      : `Audio prepared. Sending the sample to ${selectedProvider === 'songrec' ? 'SongRec' : 'ShazamIO'} through the local helper…`;
    const songs = selectedProvider === 'audiotag'
      ? await recognize(sample, key, signal)
      : await recognizeLocal(sample, signal, isLocalRecognitionProvider(selectedProvider) ? selectedProvider : 'local-shazam');
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const unique = [...new Map(songs.map((song) => [`${song.title.trim().toLocaleLowerCase()}\0${song.artist.trim().toLocaleLowerCase()}`, song])).values()];
    if (unique.length === 0) return `${selectedProvider === 'audiotag' ? 'AudioTag' : 'Local Shazam helper'} found no song match in the selected sample.`;
    if (unique.length > 1) {
      result.replaceChildren();
      const heading = document.createElement('h2');
      heading.textContent = 'Multiple possible songs';
      const hint = document.createElement('p');
      hint.textContent = 'Choose a song to search manually.';
      result.append(heading, hint);
      for (const song of unique.slice(0, 5)) {
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.className = 'secondary';
        choose.textContent = `${song.title} · ${song.artist}`;
        choose.addEventListener('click', () => {
          get<HTMLInputElement>('song-title').value = song.title;
          get<HTMLInputElement>('song-artist').value = song.artist;
          manualForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        result.append(choose);
      }
      return 'Several possible songs were returned. Select one to fill the manual search form.';
    }
    try {
      await resolve(unique[0]!, signal);
      return 'Song recognized and anime search complete.';
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      return `Song recognized. Anime lookup could not complete: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  });
}, { signal: pageLifecycle.signal });

manualForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const song = { title: get<HTMLInputElement>('song-title').value.trim(), artist: get<HTMLInputElement>('song-artist').value.trim() };
  if (!song.title || !song.artist) { idleStatus.textContent = 'Enter both a song title and artist.'; idleStatus.hidden = false; return; }
  void run('Searching anime song credits…', async (signal) => {
    try {
      await resolve(song, signal);
      return 'Song lookup complete.';
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      result.replaceChildren(renderSong(song));
      return `Song entered. Anime lookup could not complete: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  });
}, { signal: pageLifecycle.signal });

provider.addEventListener('change', updateProvider, { signal: pageLifecycle.signal });
cancelButton.addEventListener('click', () => active?.abort(), { signal: pageLifecycle.signal });
updateProvider();
formsDisabled(false);
window.addEventListener('pagehide', () => {
  active?.abort();
  if (timer) clearInterval(timer);
  timer = undefined;
  pageLifecycle.abort();
}, { once: true });
