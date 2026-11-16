// Metadata-only verification: production resolver, public catalogs, fresh caches.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('local-data', { recursive: true });
const outfile = path.resolve('local-data/verify-hyouka.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { resolveAnime, clearAnimeCache } = await import(pathToFileURL(outfile).href);
const realFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = (url, init) => {
  requests.push({ host: new URL(String(url)).hostname, ...(String(url).includes('anisongdb.com') ? { query: JSON.parse(String(init.body)) } : {}) });
  return realFetch(url, init);
};
const cases = [
  { title: '\u672a\u5b8c\u6210\u30b9\u30c8\u30e9\u30a4\u30c9', artist: 'Saori Kodama' },
  { title: '\u672a\u5b8c\u6210\u30b9\u30c8\u30e9\u30a4\u30c9', artist: '\u3053\u3060\u307e\u3055\u304a\u308a' },
  { title: 'Mikansei Stride', artist: 'Saori Codama' },
];
const observations = [];
for (const song of cases) {
  clearAnimeCache(); requests = [];
  const start = performance.now();
  let firstPublishedMs;
  try {
    const matches = await resolveAnime(song, AbortSignal.timeout(15_000), () => { firstPublishedMs ??= Math.round(performance.now() - start); });
    const kind = 'confirmed';
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), firstPublishedMs, requests, passed: matches.some(m => m.id === 12189 && m.matchKind === kind), matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), requests, passed: false, error: String(error) });
  }
  console.log(JSON.stringify(observations.at(-1)));
}
await writeFile('docs/HYOUKA_LIVE_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), version: '0.7.3', scope: 'Actual production resolver with live public metadata; not a tab-audio test.', observations }, null, 2) + '\n');
if (observations.some(item => !item.passed)) process.exitCode = 1;
