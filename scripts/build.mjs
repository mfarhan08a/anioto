import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { browserManifest } from './browser-manifests.mjs';

const root = process.cwd();
const selected = process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1] ?? 'all';
const targets = selected === 'all' ? ['edge', 'chrome', 'firefox', 'safari'] : [selected];
if (targets.some(target => !['edge', 'chrome', 'firefox', 'safari'].includes(target))) throw new Error(`Invalid browser target: ${selected}`);
const base = JSON.parse(await readFile('public/manifest.json', 'utf8'));
for (const browser of targets) {
  const directory = browser === 'edge' ? 'dist' : `dist-${browser}`;
  const outdir = path.resolve(root, directory);
  if (path.dirname(outdir) !== root || !['dist', 'dist-chrome', 'dist-firefox', 'dist-safari'].includes(path.basename(outdir))) throw new Error('Build output escaped the project root.');
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const portable = browser === 'firefox' || browser === 'safari';
  const sharedFiles = ['style.css', 'anioto-tokens.css', 'anioto-icon.png'];
  const files = [...sharedFiles, ...(portable ? ['portable.html', 'workspace.html']
    : ['anioto.css', 'anioto-manga.jpg', 'anioto-icons.svg', 'popup.html', 'options.html', 'offscreen.html', 'audio-capture-worklet.js'])];
  for (const file of files) await cp(path.join('public', file), path.join(outdir, file));
  await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(browserManifest(base, browser), null, 2) + '\n');
  await build({
    entryPoints: portable ? { 'portable-launcher': 'src/portable-launcher.ts', 'portable-workspace': 'src/portable-workspace.ts' }
      : { background: 'src/background.ts', offscreen: 'src/offscreen.ts', popup: 'src/popup.ts', options: 'src/options.ts' },
    bundle: true, format: 'iife', target: portable ? ['firefox128', 'safari17'] : 'chrome120', outdir, sourcemap: false,
  });
  console.log(`Built ${browser}: ${directory}`);
}

