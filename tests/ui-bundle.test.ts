import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

class ElementStub {
  tagName: string;
  scrollTop = 0;
  focused = false;
  open = false;
  constructor(tagName = 'div') { this.tagName = tagName; }
  focus() { this.focused = true; }
  textContent = '';
  disabled = false;
  className = '';
  hidden = false;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  onclick: (() => void) | null = null;
  onsubmit: ((event: { preventDefault(): void }) => void) | null = null;
  onerror: (() => void) | null = null;
  children: ElementStub[] = [];
  classList = {
    toggle: (_name: string, _force?: boolean) => undefined,
  };
  append(...items: ElementStub[]) { this.children.push(...items); }
  replaceChildren(...items: ElementStub[]) { this.children = [...items]; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

async function runBuiltPopup(
  localGet: (keys: string | string[]) => Promise<Record<string, unknown>> = async () => ({}),
  initialNow = Date.now(),
  writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
) {
  const elements = new Map<string, ElementStub>();
  const getElement = (id: string) => {
    let element = elements.get(id);
    if (!element) {
      element = new ElementStub();
      elements.set(id, element);
      if (id === 'progress-steps') {
        element.children = [0, 1, 2].map((step) => {
          const item = new ElementStub();
          item.dataset.step = String(step);
          return item;
        });
      }
    }
    return element;
  };
  const listeners: Array<(changes: Record<string, { newValue: unknown }>, area: string) => void> = [];
  const localWrites: Array<Record<string, unknown>> = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let now = initialNow;
  const context = vm.createContext({
    document: {
      getElementById: getElement,
      createElement: (tagName: string) => new ElementStub(tagName),
    },
    navigator: { clipboard: { writeText } },
    chrome: {
      storage: {
        session: { get: async () => ({}) },
        local: { get: localGet, set: async (value: Record<string, unknown>) => { localWrites.push(value); }, remove: async () => undefined },
        onChanged: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) },
      },
      runtime: { sendMessage: async () => ({ ok: true }), openOptionsPage: async () => undefined, getURL: () => 'chrome-extension://test/' },
    },
    structuredClone,
    URL,
    console,
    Date: { now: () => now },
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: (id: number) => { timers.delete(id); },
  });
  Object.defineProperty(context, 'status', {
    configurable: true,
    get: () => '',
    set: () => undefined,
  });
  const bundle = await readFile(path.resolve('dist/popup.js'), 'utf8');
  expect(bundle).not.toMatch(/(?:var|const|let) status\s*=\s*get\(["']status["']\)/);
  vm.runInContext(bundle, context, { filename: 'dist/popup.js' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, listeners, localWrites, writeText, setNow: (value: number) => { now = value; }, runTimers: () => [...timers.values()].forEach((callback) => callback()) };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const descendants = (node: ElementStub): ElementStub[] => [node, ...node.children.flatMap(descendants)];
afterEach(() => vi.restoreAllMocks());

describe('built popup UI', () => {
  it('shows Romaji as a subtitle and copies either title without repeating identical titles', async () => {
    const { elements, listeners, writeText, localWrites } = await runBuiltPopup();
    const english = 'Witch Hat Atelier';
    const romaji = 'Tongari Boushi no Atelier';
    listeners.forEach(listener => listener({ job: { newValue: {
      id: 'titles', stage: 'complete', message: 'Done',
      result: {
        song: { title: "Wind's Anthem", artist: 'Eve' },
        anime: [
          { id: 147105, title: english, romajiTitle: romaji, evidence: 'Credit', matchKind: 'confirmed' },
          { id: 97940, title: 'Black Clover', romajiTitle: 'Black Clover', evidence: 'Credit', matchKind: 'confirmed' },
        ],
      },
    } } }, 'session'));
    await tick();
    const nodes = descendants(elements.get('result')!);
    expect(nodes.find(node => node.tagName === 'h2')?.textContent).toBe(english);
    expect(nodes.filter(node => node.className === 'anime-romaji-title').map(node => node.textContent)).toEqual([romaji]);
    const buttons = nodes.filter(node => node.className === 'secondary copy-title-button');
    expect(buttons.map(node => node.textContent)).toEqual(['Copy English', 'Copy Romaji', 'Copy title']);
    await buttons[0]?.onclick?.();
    await buttons[1]?.onclick?.();
    expect(writeText.mock.calls).toEqual([[english], [romaji]]);
    expect(localWrites[0]).toMatchObject({ history: [{ result: { anime: [{ title: english, romajiTitle: romaji }, expect.anything()] } }] });
  });

  it('copies each anime title verbatim and reports clipboard failure', async () => {
    const { elements, listeners, writeText } = await runBuiltPopup();
    const titles = ['Princess-Session Orchestra', '響け！ユーフォニアム'];
    listeners.forEach(listener => listener({ job: { newValue: {
      id: 'copy', stage: 'complete', message: 'Done',
      result: {
        song: { title: 'Song', artist: 'Artist' },
        anime: titles.map((title, id) => ({ id, title, evidence: 'Credit', matchKind: 'confirmed' })),
      },
    } } }, 'session'));
    await tick();
    expect(writeText).not.toHaveBeenCalled();
    const actions = descendants(elements.get('result')!).filter(node => node.className === 'copy-title-action');
    expect(actions).toHaveLength(titles.length);
    for (const [index, action] of actions.entries()) {
      const [button, feedback] = action.children;
      expect(button?.tagName).toBe('button');
      expect(button?.attributes.get('aria-label')).toContain(titles[index]);
      expect(feedback?.attributes.get('role')).toBe('status');
      await button?.onclick?.();
      expect(writeText).toHaveBeenLastCalledWith(titles[index]);
      expect(feedback?.textContent).toBe('Copied');
    }
    writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
    await actions[0]?.children[0]?.onclick?.();
    expect(actions[0]?.children[1]?.textContent).toContain('Couldn’t copy');
  });

  it('places the anime hero before song metadata, keeps alternatives and collapses source explanations', async () => {
    const { elements, listeners } = await runBuiltPopup();
    listeners.forEach(listener => listener({ job: { newValue: {
      id: 'artwork', stage: 'complete', message: 'Done', result: {
        song: { title: 'CHE.R.RY', artist: 'Cover artist', album: 'A very long album' },
        anime: [
          { id: 1, title: 'Alya Sometimes Hides Her Feelings in Russian', type: 'Ending 8', sourceUrl: 'https://example.test', coverUrl: 'https://example.test/cover.jpg', evidence: 'Detailed source credits', matchKind: 'possible' },
          { id: 2, title: 'ReLIFE: Final Arc', sourceUrl: 'javascript:alert(1)', evidence: 'Other credit', matchKind: 'possible' },
        ],
      },
    } } }, 'session'));
    await tick();
    const cards = elements.get('result')!.children;
    expect(cards[0]!.className).toBe('anime-card primary-anime');
    expect(cards[1]!.className).toBe('song-card');
    expect(cards[2]!.textContent).toContain('Other connections');
    expect(descendants(cards[0]!).some(node => node.textContent === 'Possible connection')).toBe(true);
    const credits = descendants(cards[0]!).find(node => node.className === 'match-details')!;
    expect(credits.open).toBe(false);
    expect(descendants(credits).some(node => node.textContent === 'Detailed source credits')).toBe(true);
    expect(descendants(cards.at(-1)!).some(node => node.tagName === 'a')).toBe(false);
    expect(elements.get('empty-state')?.hidden).toBe(true);
  });

  it('navigates without clearing results or moving the user during metadata updates, and scrolls only for the first anime', async () => {
    const { elements, listeners } = await runBuiltPopup();
    const change = (anime: unknown[]) => listeners.forEach(listener => listener({ job: { newValue: { id: 'scroll', stage: 'resolving anime', message: 'Searching', result: { song: { title: 'Song', artist: 'Artist' }, anime } } } }, 'session'));
    change([]); await tick();
    elements.get('view-scroll')!.scrollTop = 200;
    const anime = { id: 1, title: 'Anime', sourceUrl: 'https://example.test', evidence: 'Credit', matchKind: 'confirmed' };
    change([anime]); await tick();
    expect(elements.get('view-scroll')?.scrollTop).toBe(0);
    elements.get('view-scroll')!.scrollTop = 120;
    change([{ ...anime, coverUrl: 'https://example.test/cover.jpg' }]); await tick();
    expect(elements.get('view-scroll')?.scrollTop).toBe(120);
    elements.get('nav-search')?.onclick?.();
    expect(elements.get('result-view')?.hidden).toBe(true);
    expect(elements.get('search-view')?.hidden).toBe(false);
    expect(elements.get('search-heading')?.focused).toBe(true);
    expect(elements.get('nav-search')?.attributes.get('aria-pressed')).toBe('true');
    change([anime]); await tick();
    expect(elements.get('search-view')?.hidden).toBe(false);
    elements.get('nav-result')?.onclick?.();
    expect(elements.get('result-view')?.hidden).toBe(false);
    expect(elements.get('search-view')?.hidden).toBe(true);
    expect(elements.get('result')?.children.length).toBeGreaterThan(0);
  });
  it('shows progressive listening and recognition as active and advances its elapsed timer', async () => {
    const { elements, listeners, setNow, runTimers } = await runBuiltPopup(undefined, 4500);
    listeners.forEach(listener => listener({ job: { newValue: { id: 'early', stage: 'listening and recognizing', startedAt: 1000, stageStartedAt: 1000, message: 'Checking the 3-second sample while listening continues.' } } }, 'session'));
    await tick();
    expect(elements.get('progress-label')?.textContent).toBe('Listening and recognizing');
    expect(elements.get('progress-detail')?.textContent).toContain('3-second sample');
    expect(elements.get('progress-bar')?.attributes.has('aria-valuenow')).toBe(false);
    expect(elements.get('identify')?.disabled).toBe(true);
    expect(elements.get('cancel')?.disabled).toBe(false);
    setNow(6000); runTimers();
    expect(elements.get('elapsed-summary')?.textContent).toContain('0:05');
  });
  it('shows timed capture progress, indeterminate lookup, and clears active controls at terminal state', async () => {
    const { elements, listeners, localWrites } = await runBuiltPopup();
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));

    change({ id: 'job-1', stage: 'capturing', stageStartedAt: Date.now() - 7500, message: 'Listening to the selected tab for 15 seconds.' });
    await tick();
    expect(elements.get('status')?.hidden).toBe(true);
    expect(elements.get('progress-label')?.textContent).toBe('Recording tab audio');
    expect(elements.get('progress')?.hidden).toBe(false);
    expect(Number(elements.get('progress-bar')?.attributes.get('aria-valuenow'))).toBeGreaterThan(40);
    expect(Number(elements.get('progress-bar')?.attributes.get('aria-valuenow'))).toBeLessThan(60);
    expect(elements.get('identify')?.disabled).toBe(true);
    expect(elements.get('cancel')?.disabled).toBe(false);

    change({ id: 'job-1', stage: 'recognizing', stageStartedAt: Date.now(), message: 'Checking the sample.' });
    await tick();
    expect(elements.get('progress-label')?.textContent).toBe('Recognizing the song');
    expect(elements.get('progress-bar')?.attributes.has('aria-valuenow')).toBe(false);

    change({ id: 'job-1', stage: 'resolving anime', stageStartedAt: Date.now(), message: 'Searching documented anime song associations.', result: { song: { title: 'Song', artist: 'Artist' }, anime: [] } });
    await tick();
    expect(elements.get('progress-bar')?.attributes.has('aria-valuenow')).toBe(false);
    expect(elements.get('progress-fill')?.classList).toBeDefined();
    expect(elements.get('result')?.children.some((child) => child.textContent.includes('No confirmed anime'))).toBe(false);
    expect(elements.get('progress-detail')?.textContent).toContain('Searching documented anime song associations.');
    expect(localWrites).toHaveLength(0);

    change({ id: 'job-1', stage: 'song-only', message: 'No confirmed anime connection found.', result: { song: { title: 'Song', artist: 'Artist' }, anime: [] } });
    await tick();
    expect(elements.get('progress')?.hidden).toBe(true);
    expect(elements.get('identify')?.disabled).toBe(false);
    expect(elements.get('cancel')?.disabled).toBe(true);
    expect(elements.get('status')?.textContent).toBe('No confirmed anime connection found.');
    expect(elements.get('result')?.children.some((child) => child.textContent.includes('No confirmed anime'))).toBe(false);
    expect(localWrites).toHaveLength(1);

    change({ id: 'job-1', stage: 'song-only', message: 'Song recognized; anime lookup unavailable. AnimeThemes is unavailable (HTTP 503).', result: { song: { title: 'Song', artist: 'Artist' }, anime: [] } });
    await tick();
    expect(elements.get('status')?.textContent).toContain('HTTP 503');
    expect(elements.get('result')?.children.some((child) => child.textContent.includes('No confirmed anime'))).toBe(false);

    change({ id: 'job-1', stage: 'complete', message: 'Song and anime associations found.', result: { song: { title: 'Song', artist: 'Artist' }, anime: [{ id: 1, title: 'Anime', sourceUrl: 'https://example.test', evidence: 'Theme song', matchKind: 'possible' }] } });
    await tick();
    expect(descendants(elements.get('result')!).some(node => node.textContent === 'Possible connection')).toBe(true);
  });

  it('hides progress and re-enables controls after cancellation and failure', async () => {
    const { elements, listeners } = await runBuiltPopup();
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));
    for (const stage of ['cancelled', 'failed']) {
      change({ id: `job-${stage}`, stage: 'capturing', stageStartedAt: Date.now(), message: 'Recording.' });
      await tick();
      change({ id: `job-${stage}`, stage, message: stage === 'failed' ? 'Recognition failed.' : 'Cancelled.' });
      await tick();
      expect(elements.get('progress')?.hidden).toBe(true);
      expect(elements.get('identify')?.disabled).toBe(false);
      expect(elements.get('cancel')?.disabled).toBe(true);
    }
  });

  it('shows an honest half-way counter for a 12-second capture', async () => {
    const { elements, listeners } = await runBuiltPopup(async () => ({}), 100_000);
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));
    change({ id: 'local-capture', stage: 'capturing', captureSeconds: 12, stageStartedAt: 94_000, message: 'A stale generic capture message.' });
    await tick();
    expect(elements.get('progress-bar')?.attributes.get('aria-valuenow')).toBe('50');
    expect(elements.get('progress-value')?.textContent).toBe('6 of 12 seconds');
    expect(elements.get('progress-detail')?.textContent).toContain('12-second sample');
    expect(elements.get('progress-detail')?.textContent).toContain('12-second sample');
    expect(elements.get('progress-detail')?.textContent).not.toContain('15 seconds');
  });

  it('updates both elapsed clocks every second and freezes the terminal total', async () => {
    const { elements, listeners, setNow, runTimers } = await runBuiltPopup(async () => ({}), 100_000);
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));
    change({ id: 'timed', stage: 'resolving anime', startedAt: 90_000, stageStartedAt: 95_000, message: 'Searching.' });
    await tick();
    expect(elements.get('elapsed-summary')?.textContent).toBe('Total time: 0:10 · This stage: 0:05');

    setNow(101_000);
    runTimers();
    expect(elements.get('elapsed-summary')?.textContent).toBe('Total time: 0:11 · This stage: 0:06');

    change({ id: 'timed', stage: 'complete', startedAt: 90_000, finishedAt: 102_000, message: 'Done.' });
    await tick();
    expect(elements.get('progress')?.hidden).toBe(true);
    expect(elements.get('elapsed-summary')?.textContent).toBe('Total time: 0:12');
    setNow(140_000);
    runTimers();
    expect(elements.get('elapsed-summary')?.textContent).toBe('Total time: 0:12');
  });

  it('clears stale results as soon as a new job starts', async () => {
    const { elements, listeners } = await runBuiltPopup();
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));
    change({ id: 'first', stage: 'complete', message: 'Complete', result: { song: { title: 'Old song', artist: 'Artist' }, anime: [] } });
    await tick();
    expect(elements.get('result')?.children.length).toBeGreaterThan(0);
    change({ id: 'second', stage: 'capturing', stageStartedAt: Date.now(), message: 'Recording.' });
    await tick();
    expect(elements.get('result')?.children).toHaveLength(0);
  });

  it('ignores an older result when its storage lookup finishes after a newer job update', async () => {
    let releaseLookup!: () => void;
    const blockedLookup = new Promise<void>((resolve) => { releaseLookup = resolve; });
    const { elements, listeners } = await runBuiltPopup(async (keys) => {
      if (Array.isArray(keys) && keys.includes('overrides')) await blockedLookup;
      return {};
    });
    const change = (job: object) => listeners.forEach((listener) => listener({ job: { newValue: job } }, 'session'));
    change({ id: 'older', stage: 'complete', message: 'Old', result: { song: { title: 'Old song', artist: 'Artist' }, anime: [] } });
    await tick();
    change({ id: 'newer', stage: 'capturing', stageStartedAt: Date.now(), message: 'Recording.' });
    await tick();
    releaseLookup();
    await tick();
    expect(elements.get('result')?.children).toHaveLength(0);
  });
});
