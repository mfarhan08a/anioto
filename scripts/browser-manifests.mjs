/** One source manifest; portable targets intentionally exclude Chromium capture APIs. */
export function browserManifest(base, browser) {
  if (!['chrome', 'edge', 'firefox', 'safari'].includes(browser)) throw new Error(`Unknown browser target: ${browser}`);
  const manifest = structuredClone(base);
  if (browser === 'edge' || browser === 'chrome') {
    manifest.minimum_chrome_version = '120';
    return manifest;
  }
  delete manifest.background;
  delete manifest.options_page;
  delete manifest.minimum_chrome_version;
  manifest.action = { default_popup: 'portable.html', default_title: 'Anioto · file and manual lookup', default_icon: 'anioto-icon.png' };
  manifest.permissions = [];
  manifest.host_permissions = [...new Set([...base.host_permissions, 'http://127.0.0.1:18742/*'])];
  manifest.description = 'Find anime from song details or a selected audio file. Live tab capture is unavailable in this build.';
  if (browser === 'firefox') manifest.browser_specific_settings = { gecko: { id: 'anime-song-finder@local', strict_min_version: '128.0' } };
  return manifest;
}
