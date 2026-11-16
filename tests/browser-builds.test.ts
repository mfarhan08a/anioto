import { readFile, access } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
it('keeps Chrome/Edge capture permissions and a supported minimum browser version', async () => {
  for (const directory of ['dist', 'dist-chrome']) {
    const manifest = await read(`${directory}/manifest.json`);
    expect(manifest.minimum_chrome_version).toBe('120');
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'tabCapture', 'offscreen', 'storage', 'nativeMessaging']));
    expect(manifest.background.service_worker).toBe('background.js');
    await access(`${directory}/background.js`); await access(`${directory}/offscreen.js`);
    const worklet = await readFile(`${directory}/audio-capture-worklet.js`, 'utf8');
    expect(worklet).toContain("registerProcessor('anime-song-capture'");
    expect(await readFile(`${directory}/offscreen.js`, 'utf8')).not.toContain('createScriptProcessor');
    await access(`${directory}/${manifest.action.default_popup}`);
  }
});
it('packages visible Firefox/Safari workspaces without unsupported tabCapture/offscreen/background APIs', async () => {
  for (const directory of ['dist-firefox', 'dist-safari']) {
    const manifest = await read(`${directory}/manifest.json`);
    expect(manifest.background).toBeUndefined();
    expect(manifest.options_page).toBeUndefined();
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['tabCapture']));
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['offscreen']));
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['nativeMessaging']));
    expect(manifest.host_permissions).toContain('http://127.0.0.1:18742/*');
    await access(`${directory}/${manifest.action.default_popup}`);
    await access(`${directory}/workspace.html`);
    const bundle = await readFile(`${directory}/portable-workspace.js`, 'utf8');
    expect(bundle).not.toContain('chrome.tabCapture');
    expect(bundle).not.toContain('chrome.offscreen');
    expect(bundle).not.toContain('getDisplayMedia');
    expect(bundle).not.toContain('getUserMedia');
    expect(bundle).toContain('anisongdb.com');
    expect(bundle).toContain('audiotag.info');
  }
  expect((await read('dist-firefox/manifest.json')).browser_specific_settings.gecko.id).toBe('anime-song-finder@local');
  expect((await read('dist-safari/manifest.json')).browser_specific_settings).toBeUndefined();
});
