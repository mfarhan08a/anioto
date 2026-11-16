// Metadata-only verification: production resolver, public catalogs, fresh caches.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('local-data', { recursive: true });
const outfile = path.resolve('local-data/verify-bookworm.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { resolveAnime, clearAnimeCache } = await import(pathToFileURL(outfile).href);
const realFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = (url, init) => {
  requests.push({ host: new URL(String(url)).hostname, ...(String(url).includes('anisongdb.com') ? { query: JSON.parse(String(init.body)) } : {}) });
  return realFetch(url, init);
};
const cases = [
  { title: 'Kamikazari No Tenshi TV size ver.', artist: 'Megumi Nakajima' },
  { title: '髪飾りの天使（TVサイズ）', artist: '中島 愛' },
  { title: 'Kamikazari no Tenshi', artist: 'Megumi Nakajima' },
];
const observations = [];
for (const song of cases) {
  clearAnimeCache(); requests = [];
  const start = performance.now();
  let firstPublishedMs;
  try {
    const matches = await resolveAnime(song, AbortSignal.timeout(15_000), () => { firstPublishedMs ??= Math.round(performance.now() - start); });
    const kind = /TV/i.test(song.title) ? 'version' : 'confirmed';
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), firstPublishedMs, requests, passed: matches.some(m => m.id === 108268 && m.matchKind === kind), matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), requests, passed: false, error: String(error) });
  }
  console.log(JSON.stringify(observations.at(-1)));
}
await writeFile('docs/BOOKWORM_LIVE_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), version: '0.6.4', scope: 'Actual production resolver with live public metadata; not a tab-audio test.', observations }, null, 2) + '\n');
if (observations.some(item => !item.passed)) process.exitCode = 1;
