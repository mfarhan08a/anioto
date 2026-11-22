import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('loads and saves store provider settings and consent without requiring the development settings form', async () => {
  const local: Record<string, any> = {};
  const elements = new Map<string, any>();
  const ids = ['provider', 'status', 'audd-consent', 'install-companion', 'settings-form', 'save-provider', 'override-form', 'export', 'import', 'clear-overrides'];
  for (const id of ids) elements.set(id, { value: '', checked: false, disabled: true });
  const bundled = await build({
    entryPoints: ['src/options.ts'], bundle: true, write: false, format: 'iife',
    define: { ANIOTO_STORE_CONFIG: JSON.stringify({ recognitionUrl: 'https://recognition.example/v1/recognize', helperUrl: 'https://recognition.example/companion' }) },
  });
  runInNewContext(bundled.outputFiles[0]!.text, {
    document: { getElementById: (id: string) => elements.get(id) ?? null },
    chrome: { storage: { local: {
      get: async () => local,
      set: async (value: object) => Object.assign(local, value),
    } } },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const provider = elements.get('provider');
  expect(provider.value).toBe('songrec');
  expect(provider.disabled).toBe(false);
  expect(elements.get('install-companion').href).toBe('https://recognition.example/companion');
  provider.value = 'audd';
  elements.get('audd-consent').checked = true;
  await elements.get('settings-form').onsubmit({ preventDefault() {} });
  expect(local).toEqual({ preferredProvider: 'audd', settings: { auddConsent: true } });
});

it('lists the three store providers in the intended order', async () => {
  const form = await readFile('public/store-settings.html', 'utf8');
  const providers = [...form.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
  expect(providers).toEqual(['songrec', 'local-shazam', 'audd']);
  expect(form).not.toContain('api-key');
});

it('disables AudD in a local-only release and recovers a stale cloud preference', async () => {
  const local: Record<string, any> = { preferredProvider: 'audd', settings: { auddConsent: true } };
  const elements = new Map<string, any>();
  for (const id of ['provider', 'status', 'audd-consent', 'audd-settings', 'install-companion', 'settings-form', 'save-provider', 'override-form', 'export', 'import', 'clear-overrides']) elements.set(id, { value: '', checked: false, disabled: true });
  const bundled = await build({ entryPoints: ['src/options.ts'], bundle: true, write: false, format: 'iife', define: { ANIOTO_STORE_CONFIG: JSON.stringify({ recognitionUrl: null, helperUrl: 'https://github.com/mfarhan08a/anioto' }) } });
  runInNewContext(bundled.outputFiles[0]!.text, { document: { getElementById: (id: string) => elements.get(id) ?? null }, chrome: { storage: { local: { get: async () => local, set: async (value: object) => Object.assign(local, value) } } } });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(elements.get('provider').value).toBe('songrec');
  expect(elements.get('audd-consent').disabled).toBe(true);
  expect(elements.get('audd-consent').checked).toBe(false);
  expect(elements.get('audd-settings').hidden).toBe(true);
  elements.get('provider').value = 'local-shazam';
  await elements.get('settings-form').onsubmit({ preventDefault() {} });
  expect(local).toEqual({ preferredProvider: 'local-shazam', settings: { auddConsent: false } });
  elements.get('provider').value = 'audd';
  await elements.get('settings-form').onsubmit({ preventDefault() {} });
  expect(local.preferredProvider).toBe('local-shazam');
  expect(elements.get('status').textContent).toContain('not available');
});
