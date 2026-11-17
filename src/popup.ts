import type { Job, Result } from './contracts';
import { identity, parsePersonal, safeUrl } from './personal';
import { elapsedView, progressView } from './progress';
import { createAnimeTitleDisplay } from './anime-title';
import { storeConfig } from './release';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = get('popup-shell');
const statusElement = get('status');
const result = get('result');
let currentJobId = '';
let displayedResult = '';
let updateGeneration = 0;
let progressTimer: ReturnType<typeof setInterval> | undefined;
type View = 'result' | 'search' | 'history' | 'more';
let currentView: View = 'result';
let revealedAnime = false;
const openCredits = new Set<string>();

function showView(view: View, focus = false) {
  currentView = view;
  shell.dataset.view = view;
  for (const name of ['result', 'search', 'history', 'more'] as const) {
    get(`${name}-view`).hidden = name !== view;
    get(`nav-${name}`).setAttribute('aria-pressed', String(name === view));
  }
  get('view-scroll').scrollTop = 0;
  if (focus) get(`${view}-heading`).focus({ preventScroll: true });
}

function render(value: Result, fromHistory = false) {
  const focusedId = document.activeElement?.id;
  result.replaceChildren();
  get('empty-state').hidden = true;

  const animeCard = (anime: Result['anime'][number], index: number) => {
    const card = document.createElement('article');
    card.className = `anime-card${index === 0 ? ' primary-anime' : ''}`;
    const hero = document.createElement('div');
    hero.className = 'hero';
    const placeholder = document.createElement('div');
    placeholder.className = 'cover-placeholder';
    placeholder.textContent = '♪';
    placeholder.setAttribute('aria-hidden', 'true');
    const cover = anime.coverUrl ? safeUrl(anime.coverUrl) : undefined;
    if (cover) {
      const image = document.createElement('img');
      image.className = 'anime-cover';
      image.src = cover;
      image.alt = '';
      image.width = index === 0 ? 101 : 49;
      image.height = index === 0 ? 141 : 69;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => { image.replaceWith(placeholder); };
      hero.append(image);
    } else hero.append(placeholder);
    const info = document.createElement('div');
    info.className = 'anime-info';
    const badge = document.createElement('span');
    badge.className = `match-badge kind-${anime.matchKind ?? 'personal'}`;
    badge.textContent = anime.matchKind === 'possible' ? 'Possible connection'
      : anime.matchKind === 'version' ? 'Version match'
        : anime.matchKind === 'confirmed' ? 'Match found' : 'Saved connection';
    info.append(badge, createAnimeTitleDisplay(anime, index === 0 ? 'h2' : 'h3', `copy-title-${index}`));
    if (anime.type) {
      const type = document.createElement('p');
      type.className = 'theme-type';
      type.textContent = anime.type;
      info.append(type);
    }
    hero.append(info);
    card.append(hero);
    const details = document.createElement('details');
    details.className = 'match-details';
    const key = `${anime.id}|${anime.title}`;
    details.open = openCredits.has(key);
    details.ontoggle = () => { if (details.open) openCredits.add(key); else openCredits.delete(key); };
    const summary = document.createElement('summary');
    summary.id = `credit-${index}-summary`;
    summary.textContent = anime.matchKind === 'possible' ? 'Why this is possible' : 'Credits & sources';
    const evidence = document.createElement('p');
    evidence.textContent = anime.evidence;
    details.append(summary, evidence);
    for (const [label, rawUrl, suffix] of [
      ['View source', anime.sourceUrl, 'source'],
      ['Recording reference', anime.recordingReferenceUrl, 'recording'],
    ]) {
      const url = rawUrl ? safeUrl(rawUrl) : undefined;
      if (!url) continue;
      const link = document.createElement('a');
      link.id = `credit-${index}-${suffix}`;
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label ?? '';
      details.append(link);
    }
    card.append(details);
    return card;
  };

  if (value.anime[0]) result.append(animeCard(value.anime[0], 0));
  const songCard = document.createElement('article');
  songCard.className = 'song-card';
  const recordMark = document.createElement('span');
  recordMark.className = 'song-record';
  recordMark.setAttribute('aria-hidden', 'true');
  const songCredit = document.createElement('div');
  songCard.append(recordMark, songCredit);
  const heading = document.createElement(value.anime.length ? 'h3' : 'h2');
  heading.className = 'song-title';
  heading.textContent = value.song.title;
  songCredit.append(heading);
  const artist = document.createElement('p');
  artist.className = 'song-artist';
  artist.textContent = value.song.artist;
  songCredit.append(artist);
  if (value.song.album) {
    const details = document.createElement('details');
    details.className = 'album-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Album';
    const album = document.createElement('p');
    album.textContent = value.song.album;
    details.append(summary, album);
    songCredit.append(details);
  }
  result.append(songCard);

  if (!value.anime.length && fromHistory) {
    const noMatch = document.createElement('p');
    noMatch.textContent = 'No confirmed anime connection found.';
    result.append(noMatch);
  }
  if (value.anime.length > 1) {
    const heading = document.createElement('h3');
    heading.className = 'alternative-heading';
    heading.textContent = `Other connections · ${value.anime.length - 1}`;
    result.append(heading);
    value.anime.slice(1).forEach((anime, index) => result.append(animeCard(anime, index + 1)));
  }
  if (currentView === 'result' && (focusedId?.startsWith('credit-') || focusedId?.startsWith('copy-title-'))) {
    document.getElementById(focusedId)?.focus({ preventScroll: true });
  }
}

function paintProgress(job: Job) {
  const view = progressView(job);
  const panel = get('progress');
  panel.hidden = !view.active;
  if (!view.active) return;

  get('progress-label').textContent = view.label;
  get('progress-detail').textContent = view.detail;
  const fill = get<HTMLElement>('progress-fill');
  const bar = get('progress-bar');
  const valueText = get('progress-value');
  for (const item of Array.from(get('progress-steps').children)) {
    const index = Number((item as HTMLElement).dataset.step);
    item.classList.toggle('current', index === view.step);
    item.classList.toggle('complete', index < view.step);
    if (index === view.step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  fill.classList.toggle('indeterminate', !view.determinate);
  if (view.determinate) {
    fill.style.width = `${view.percent ?? 0}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(view.percent ?? 0)));
    bar.removeAttribute('aria-valuetext');
    const duration = view.captureSeconds ?? 15;
    const elapsed = Math.floor(view.captureElapsedSeconds ?? 0);
    valueText.textContent = elapsed < duration ? `${elapsed} of ${duration} seconds` : `${duration}+ seconds captured`;
  } else {
    fill.style.width = '';
    bar.removeAttribute('aria-valuenow');
    bar.setAttribute('aria-valuetext', 'In progress');
    valueText.textContent = 'In progress';
  }
}

function paintElapsed(job: Job) {
  const summary = get('elapsed-summary');
  const elapsed = elapsedView(job);
  const text = elapsed.activeText ?? elapsed.terminalText;
  summary.hidden = !text;
  summary.textContent = text ?? '';
}

async function update(job: Job | undefined) {
  if (!job) return;
  const generation = ++updateGeneration;
  if (currentJobId !== job.id) {
    currentJobId = job.id;
    displayedResult = '';
    result.replaceChildren();
    revealedAnime = false;
    openCredits.clear();
    if (currentView === 'result') get('view-scroll').scrollTop = 0;
  }

  const view = progressView(job);
  shell.dataset.busy = String(view.active);
  shell.dataset.stage = job.stage;
  statusElement.hidden = view.active;
  statusElement.textContent = job.result?.anime.length && !view.active
    ? job.result.anime.some(anime => anime.matchKind === 'possible') ? 'Possible connections · performer not verified.' : 'Song and anime found.'
    : job.message;
  get('empty-state').hidden = view.active || Boolean(job.result);
  const activeControl = document.activeElement?.id;
  get<HTMLButtonElement>('identify').disabled = view.active;
  get<HTMLButtonElement>('cancel').disabled = !view.active;
  get('cancel').hidden = !view.active;
  get('identify').hidden = view.active;
  if (activeControl === 'identify' && view.active) get('cancel').focus();
  else if (activeControl === 'cancel' && !view.active) get('identify').focus();
  get<HTMLButtonElement>('test-capture').disabled = view.active;
  paintProgress(job);
  paintElapsed(job);
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = view.active
    ? setInterval(() => {
      paintProgress(job);
      paintElapsed(job);
    }, 1000)
    : undefined;

  const preview = get('preview');
  preview.replaceChildren();
  if (job.stage === 'sample-ready' && job.previewUrl?.startsWith(`blob:${chrome.runtime.getURL('')}`)) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = job.previewUrl;
    audio.setAttribute('aria-label', 'Local tab audio preview');
    preview.append(audio);
    if (currentView === 'result') showView('more', true);
  }

  // The resolver may publish the recognized song first, then replace the
  // same job result with anime matches. Render every material update.
  if (job.result) {
    const value = structuredClone(job.result);
    const stored = await chrome.storage.local.get(['overrides', 'history']);
    if (currentJobId !== job.id || generation !== updateGeneration) return;
    const personal = parsePersonal(stored.overrides ?? []).filter((entry) => identity(entry.song) === identity(value.song));
    if (personal.length) value.anime = personal.map((entry) => entry.anime);
    const fingerprint = JSON.stringify(value);
    if (displayedResult !== fingerprint) {
      displayedResult = fingerprint;
      render(value);
      if (value.anime.length && !revealedAnime) {
        revealedAnime = true;
        if (currentView === 'result') get('view-scroll').scrollTop = 0;
      }
    }
    if (['complete', 'song-only'].includes(job.stage)) {
      const history = Array.isArray(stored.history) ? stored.history : [];
      const existingIndex = history.findIndex((entry: { id: string }) => entry.id === job.id);
      if (existingIndex < 0) {
        if (generation !== updateGeneration || currentJobId !== job.id) return;
        await chrome.storage.local.set({ history: [{ id: job.id, result: value }, ...history].slice(0, 100) });
      } else if (JSON.stringify(history[existingIndex]?.result) !== JSON.stringify(value)) {
        const refreshedHistory = [...history];
        refreshedHistory[existingIndex] = { ...refreshedHistory[existingIndex], result: value };
        if (generation !== updateGeneration || currentJobId !== job.id) return;
        await chrome.storage.local.set({ history: refreshedHistory });
      }
      if (generation !== updateGeneration || currentJobId !== job.id) return;
      await historyView();
    }
  }
}

async function send(message: object) {
  if ('type' in message && ['START', 'LOOKUP', 'TEST_CAPTURE'].includes(String(message.type))) showView('result', message.type !== 'START');
  if ('type' in message && message.type === 'START') {
    get('helper-setup').hidden = true;
    get<HTMLButtonElement>('identify').disabled = true;
    statusElement.hidden = false;
    statusElement.textContent = 'Preparing recognition…';
  }
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (response?.error) {
      if (storeConfig && response.helperSetup) get('helper-setup').hidden = false;
      get<HTMLButtonElement>('identify').disabled = false;
      statusElement.hidden = false;
      statusElement.textContent = response.error;
      showView('result');
      return;
    }
    if (message && 'type' in message && (message.type === 'START' || message.type === 'LOOKUP')) {
      result.replaceChildren();
      displayedResult = '';
    }
    await refresh();
  } catch {
    get<HTMLButtonElement>('identify').disabled = false;
    statusElement.hidden = false;
    statusElement.textContent = 'Could not complete the request. Check settings or reload the extension.';
  }
}

async function refresh() {
  const data = await chrome.storage.session.get('job');
  await update(data.job);
}

async function historyView() {
  const { history = [] } = await chrome.storage.local.get('history');
  const box = get('history');
  box.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Your identified songs will appear here.';
    box.append(empty);
  }
  for (const item of history) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary history-item';
    const note = document.createElement('span');
    note.className = 'history-note';
    note.setAttribute('aria-hidden', 'true');
    note.textContent = '♫';
    const credit = document.createElement('span');
    credit.className = 'history-credit';
    credit.textContent = item.result.song.title;
    const artist = document.createElement('span');
    artist.textContent = ` · ${item.result.song.artist}`;
    credit.append(artist);
    const arrow = document.createElement('span');
    arrow.className = 'history-chevron';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(note, credit, arrow);
    button.onclick = () => {
      openCredits.clear();
      showView('result', true);
      render(item.result, true);
      statusElement.hidden = false;
      statusElement.textContent = 'From your recent results.';
      get('elapsed-summary').hidden = true;
    };
    box.append(button);
  }
}

get('test-capture').onclick = () => void send({ type: 'TEST_CAPTURE' });
get('identify').onclick = () => void send({ type: 'START' });
get('cancel').onclick = () => void send({ type: 'CANCEL' });
get('settings').onclick = () => void chrome.runtime.openOptionsPage();
if (storeConfig) {
  get<HTMLAnchorElement>('helper-install').href = storeConfig.helperUrl;
  get('change-provider').onclick = () => void chrome.runtime.openOptionsPage();
}
get('clear').onclick = async () => {
  await chrome.storage.local.remove('history');
  await historyView();
};
get('lookup').onsubmit = (event) => {
  event.preventDefault();
  void send({ type: 'LOOKUP', song: { title: get<HTMLInputElement>('title').value.trim(), artist: get<HTMLInputElement>('artist').value.trim() } });
};
for (const name of ['result', 'search', 'history', 'more'] as const) get(`nav-${name}`).onclick = () => showView(name, true);
get('home').onclick = () => showView('result', true);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.job) void update(changes.job.newValue);
});
void refresh();
void historyView();
// Opening the popup is the only automatic launch trigger. The background also
// checks before Identify in case the helper was stopped since the popup opened.
void chrome.runtime.sendMessage({ type: 'ENSURE_HELPER' }).then(async response => {
  if (response?.error && currentView === 'result' && get('progress').hidden) {
    statusElement.hidden = false;
    statusElement.textContent = response.error;
    if (storeConfig) get('helper-setup').hidden = false;
  } else if (response?.localReady && /helper is not running|helper.*not allow/i.test(statusElement.textContent ?? '')) {
    statusElement.textContent = 'Local recognition is ready. Identify this tab to try again.';
  }
}).catch(() => { /* Identify reports a concrete startup error if messaging fails. */ });
