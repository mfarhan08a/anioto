import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

class Element {
  value = ''; textContent = ''; disabled = false; hidden = false; checked = false;
  required = false; files: unknown[] = []; children: Element[] = [];
  attributes = new Map<string, string>();
  handlers = new Map<string, (event: { preventDefault(): void }) => void>();
  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void) { this.handlers.set(type, listener); }
  dispatch(type: string) { this.handlers.get(type)?.({ preventDefault() {} }); }
  append(...items: Element[]) { this.children.push(...items); }
  replaceChildren(...items: Element[]) { this.children = [...items]; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  remove() {} scrollIntoView() {}
}
function flatten(element: Element): string { return [element.textContent, ...element.children.map(flatten)].join(' '); }
async function workspace(directory: string, namespace: 'browser' | 'chrome' = 'browser') {
  const elements = new Map<string, Element>();
  const get = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  get('provider').value = 'local-shazam';
  const request = vi.fn(async (url: string | URL) => new Response(JSON.stringify(String(url).includes('anisongdb.com')
    ? [{ songName: 'Orange', songArtist: '7!!', animeENName: 'Your Lie in April', linked_ids: { anilist: 20665 }, songType: 'Ending 2' }]
    : { data: { Media: { title: { english: 'Your Lie in April' }, coverImage: { large: 'https://example.com/cover.jpg' } } } })));
  const createTab = vi.fn(async () => ({}));
  const api = { runtime: { getURL: (part: string) => `moz-extension://123e4567-e89b-12d3-a456-426614174000/${part}` }, tabs: { create: createTab } };
  const context = vm.createContext({
    [namespace]: api, document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => ['provider', 'api-key', 'audio-file', 'consent', 'song-title', 'song-artist', 'lookup-song', 'identify-file'].map(get) },
    window: { addEventListener: vi.fn() }, AbortController, AbortSignal, DOMException, URL, Response, Blob, Date,
    fetch: request, structuredClone, setTimeout, clearTimeout,
    setInterval: vi.fn(() => 1), clearInterval: vi.fn(), console,
  });
  vm.runInContext(await readFile(`${directory}/portable-workspace.js`, 'utf8'), context);
  return { get, request, context, createTab };
}

it.each([['dist-firefox', 'browser'], ['dist-safari', 'browser'], ['dist-safari', 'chrome']] as const)('runs %s manual lookup with only the %s namespace', async (directory, namespace) => {
  const { get, request } = await workspace(directory, namespace);
  get('song-title').value = 'Orange (Instrumental)'; get('song-artist').value = 'seven oops';
  get('manual-form').dispatch('submit');
  await vi.waitFor(() => expect(get('status').textContent).toBe('Song lookup complete.'));
  expect(flatten(get('result'))).toContain('Your Lie in April');
  expect(flatten(get('result'))).toContain('Version match');
  expect(request.mock.calls.every(([url]) => !String(url).includes('/recognize'))).toBe(true);
  expect(get('progress').hidden).toBe(true);
  expect(get('cancel').disabled).toBe(true);
  expect(get('lookup-song').disabled).toBe(false);
});

it('does not decode or upload an audio selection without explicit submit consent', async () => {
  const { get, request } = await workspace('dist-firefox');
  get('audio-file').files = [{ size: 200, arrayBuffer: () => { throw new Error('must not decode'); } }];
  get('audio-file').dispatch('change');
  expect(request).not.toHaveBeenCalled();
  get('audio-form').dispatch('submit');
  expect(get('idle-status').textContent).toContain('Confirm');
  expect(request).not.toHaveBeenCalled();
});

it('cancels a pending lookup, restores AudioTag key controls, and hides the loader', async () => {
  const { get, request } = await workspace('dist-firefox');
  request.mockImplementation(() => new Promise(() => {}));
  get('provider').value = 'audiotag'; get('provider').dispatch('change');
  get('api-key').value = 'in-memory-test-key';
  get('song-title').value = 'Orange'; get('song-artist').value = 'seven oops';
  get('manual-form').dispatch('submit');
  expect(get('lookup-song').disabled).toBe(true);
  get('cancel').dispatch('click');
  await vi.waitFor(() => expect(get('status').textContent).toBe('Search cancelled.'));
  expect(get('api-key').disabled).toBe(false);
  expect(get('api-key').value).toBe('in-memory-test-key');
  expect(get('progress').hidden).toBe(true);
});

it('launcher opens a persistent extension workspace and reports browser errors', async () => {
  const { get, context, createTab } = await workspace('dist-firefox');
  vm.runInContext(await readFile('dist-firefox/portable-launcher.js', 'utf8'), context);
  get('open-workspace').dispatch('click');
  expect(createTab).toHaveBeenCalledWith({ url: 'moz-extension://123e4567-e89b-12d3-a456-426614174000/workspace.html' });
  createTab.mockRejectedValueOnce(new Error('blocked'));
  get('open-workspace').dispatch('click');
  await vi.waitFor(() => expect(get('status').textContent).toContain('Could not open'));
  expect(get('open-workspace').disabled).toBe(false);
});
