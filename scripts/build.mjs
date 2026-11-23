import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { browserManifest } from './browser-manifests.mjs';

const root = process.cwd();
const store = process.argv.includes('--store');
const localOnly = process.argv.includes('--local-only');
if (localOnly && !store) throw new Error('--local-only requires --store.');
const httpsUrl = (name, value) => {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) {
    throw new Error(`${name} must be an HTTPS URL without credentials, a custom port, query, or fragment.`);
  }
  return url;
};
const storeConfig = store ? {
  recognitionUrl: localOnly ? null : httpsUrl('ANIOTO_RECOGNITION_URL', process.env.ANIOTO_RECOGNITION_URL).href,
  helperUrl: httpsUrl('ANIOTO_HELPER_URL', process.env.ANIOTO_HELPER_URL).href,
} : null;
if (storeConfig?.recognitionUrl && new URL(storeConfig.recognitionUrl).pathname !== '/v1/recognize') throw new Error('ANIOTO_RECOGNITION_URL must end in /v1/recognize.');
const selected = process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1] ?? 'all';
const targets = selected === 'all' ? (store ? ['edge', 'chrome'] : ['edge', 'chrome', 'firefox', 'safari']) : [selected];
if (targets.some(target => !['edge', 'chrome', 'firefox', 'safari'].includes(target))) throw new Error(`Invalid browser target: ${selected}`);
if (store && targets.some(target => target !== 'edge' && target !== 'chrome')) throw new Error('Store packages currently support Edge and Chrome.');
const base = JSON.parse(await readFile('public/manifest.json', 'utf8'));
for (const browser of targets) {
  const directory = store ? `dist-store-${browser}` : browser === 'edge' ? 'dist' : `dist-${browser}`;
  const outdir = path.resolve(root, directory);
  if (path.dirname(outdir) !== root || !['dist', 'dist-chrome', 'dist-firefox', 'dist-safari', 'dist-store-edge', 'dist-store-chrome'].includes(path.basename(outdir))) throw new Error('Build output escaped the project root.');
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const portable = browser === 'firefox' || browser === 'safari';
  const sharedFiles = ['style.css', 'anioto-tokens.css', 'anioto-icon.png', 'wanakana-LICENSE.txt'];
  const files = [...sharedFiles, ...(portable ? ['portable.html', 'workspace.html']
    : ['anioto.css', 'anioto-manga.jpg', 'anioto-icons.svg', 'popup.html', 'options.html', 'offscreen.html', 'audio-capture-worklet.js'])];
  for (const file of files) {
    if (store && file === 'options.html') continue;
    await cp(path.join('public', file), path.join(outdir, file));
  }
  const manifest = browserManifest(base, browser);
  if (storeConfig) {
    manifest.host_permissions = manifest.host_permissions.filter(permission => permission !== 'https://audiotag.info/*');
    if (storeConfig.recognitionUrl) manifest.host_permissions.push(`${new URL(storeConfig.recognitionUrl).origin}/*`);
    const localOptions = await readFile('public/options.html', 'utf8');
    const start = localOptions.indexOf('<p>SongRec');
    const end = localOptions.indexOf('<h2>Personal matches</h2>');
    if (start < 0 || end < start) throw new Error('Could not locate shared settings markup.');
    let storeOptions = await readFile('public/store-settings.html', 'utf8');
    if (localOnly) storeOptions = storeOptions.replace('<option value="audd">AudD (cloud recognition)</option>', '<option value="audd" disabled>AudD (not available in this release)</option>');
    await writeFile(path.join(outdir, 'options.html'), localOptions.slice(0, start) + storeOptions + localOptions.slice(end));
  }
  await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await build({
    entryPoints: portable ? { 'portable-launcher': 'src/portable-launcher.ts', 'portable-workspace': 'src/portable-workspace.ts' }
      : { background: 'src/background.ts', offscreen: 'src/offscreen.ts', popup: 'src/popup.ts', options: 'src/options.ts' },
    bundle: true, format: 'iife', target: portable ? ['firefox128', 'safari17'] : 'chrome120', outdir, sourcemap: false,
    define: { ANIOTO_STORE_CONFIG: JSON.stringify(storeConfig) },
  });
  console.log(`Built ${browser}: ${directory}`);
}

