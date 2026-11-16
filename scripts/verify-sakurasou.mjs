// Metadata only: production resolver, live catalogs, no audio or credentials.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('local-data', { recursive: true });
const outfile = path.resolve('local-data/verify-sakurasou.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { resolveAnime, clearAnimeCache } = await import(pathToFileURL(outfile).href);
const realFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = (url, init) => {
  requests.push({ host: new URL(String(url)).hostname, ...(String(url).includes('anisongdb.com') ? { query: JSON.parse(String(init.body)) } : {}) });
  return realFetch(url, init);
};
const cases = [
  { title: '君が夢を連れてきた(TVサイズ)', artist: 'Ai Kayano, 中津真莉子 & Natsumi Takamori' },
  { title: '君が夢を連れてきた（ＴＶサイズ）', artist: 'ペットな彼女たち' },
  { title: 'Kimi ga Yume wo Tsuretekita', artist: 'Ai Kayano, Mariko Nakatsu & Natsumi Takamori' },
];
const observations = [];
for (const song of cases) {
  clearAnimeCache(); requests = [];
  const start = performance.now();
  let firstPublishedMs;
  try {
    const matches = await resolveAnime(song, AbortSignal.timeout(15_000), () => { firstPublishedMs ??= Math.round(performance.now() - start); });
    const kind = song.title.includes('サイズ') ? 'version' : 'confirmed';
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), firstPublishedMs, requests, passed: matches.some(m => m.id === 13759 && m.matchKind === kind), matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), requests, passed: false, error: String(error) });
  }
  console.log(JSON.stringify(observations.at(-1)));
}
await writeFile('docs/SAKURASOU_LIVE_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), version: '0.6.3', scope: 'Actual production resolver with live public metadata, fresh cache per case. Not a tab-audio test.', observations }, null, 2) + '\n');
if (observations.some(item => !item.passed)) process.exitCode = 1;
