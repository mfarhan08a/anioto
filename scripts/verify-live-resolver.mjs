// Read-only live metadata check. Does not capture/upload audio or use API keys.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('local-data', { recursive: true });
const bundle = path.resolve('local-data/verify-resolver.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle });
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => nativeFetch(input, {
  ...init, headers: { ...init.headers, 'User-Agent': 'Mozilla/5.0 AnimeSongFinderVerification/0.3' },
});
const { resolveAnime } = await import(pathToFileURL(bundle).href);
const cases = [
  { title: 'Sign (Live)', artist: 'FLOW', expected: /Naruto/i, kind: 'version' },
  { title: 'Sign', artist: 'Test cover performer', expected: /Naruto/i, kind: 'possible' },
  { title: 'I Really Want to Stay At Your House', artist: 'Rosa Walton & Hallie Coggins', expected: /Cyberpunk: Edgerunners/i, kind: 'confirmed' },
];
const observations = [];
for (const { expected, kind, ...song } of cases) {
  const start = performance.now();
  try {
    const matches = await resolveAnime(song);
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: matches.some(match => expected.test(match.title) && match.matchKind === kind), matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: false, error: String(error) });
  }
}
const report = { date: new Date().toISOString(), scope: 'Live metadata resolver using supplied song fields; not audio recognition. Cover-performer input is synthetic; database responses are live.', observations };
await writeFile('docs/LIVE_RESOLVER_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (observations.some(item => !item.passed)) process.exitCode = 1;
