// Run the actual production resolver against public APIs; no audio/API keys.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
await mkdir('local-data', { recursive: true });
const outfile = path.resolve('local-data/verify-anisong-resolver.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { resolveAnime, clearAnimeCache } = await import(pathToFileURL(outfile).href);
clearAnimeCache();
const realFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = (url, init) => {
  requests.push(new URL(String(url)).hostname);
  return realFetch(url, init);
};
const cases = [
  { song: { title: 'Red Swan (feat. HYDE)', artist: 'YOSHIKI' }, expected: /Attack on Titan.*3|Shingeki.*3/i, kind: 'confirmed' },
  { song: { title: 'Music Train (Karaoke)', artist: 'Tatsuro Yamashita' }, expected: /Mirai/i, kind: 'version' },
  { song: { title: 'Sound of Snow', artist: 'Novelbright' }, expected: /A Sign of Affection|Yubisaki to Renren/i, kind: 'confirmed' },
  { song: { title: 'Akane Sasu (instrumental)', artist: 'Aimer' }, expected: /Natsume/i, kind: 'version' },
  { song: { title: 'Orange (Instrumental)', artist: 'seven oops' }, expected: /Your Lie in April|Shigatsu/i, kind: 'version' },
  { song: { title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' }, expected: /Your Lie in April|Shigatsu/i, kind: 'possible' },
  { song: { title: 'Sign (Live)', artist: 'FLOW' }, expected: /Naruto.*Shipp/i, kind: 'version' },
  { song: { title: 'I Really Want to Stay At Your House', artist: 'Rosa Walton & Hallie Coggins' }, expected: /Cyberpunk/i, kind: 'confirmed' },
];
const observations = [];
for (const item of cases) {
  requests = [];
  const start = performance.now();
  let firstPublishedMs;
  try {
    const matches = await resolveAnime(item.song, undefined, () => { firstPublishedMs ??= Math.round(performance.now() - start); });
    observations.push({ song: item.song, elapsedMs: Math.round(performance.now() - start), firstPublishedMs, requests: [...requests], passed: matches.some(match => item.expected.test(match.title) && match.matchKind === item.kind), matches });
  } catch (error) {
    observations.push({ song: item.song, elapsedMs: Math.round(performance.now() - start), requests: [...requests], passed: false, error: String(error) });
  }
  console.log(JSON.stringify({ song: item.song, ...observations.at(-1), matches: observations.at(-1).matches?.map(match => ({ title: match.title, kind: match.matchKind })) }));
}
requests = [];
const start = performance.now();
const warm = await resolveAnime(cases[2].song);
const cached = { elapsedMs: Math.round(performance.now() - start), requests, passed: warm.some(match => cases[2].expected.test(match.title)) && requests.length === 0 };
await writeFile('docs/TITLE_CREDIT_LIVE_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), version: '0.5.1', scope: 'Actual bundled production resolver in Node 22, live public metadata. No audio recognition. First publication measures source title delivery before optional artwork.', observations, cached }, null, 2) + '\n');
if (observations.some(row => !row.passed) || !cached.passed) process.exitCode = 1;
