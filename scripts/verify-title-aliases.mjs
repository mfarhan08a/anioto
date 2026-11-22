// Live metadata verification. No audio capture, uploads, API keys, or recognition credits.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('local-data', { recursive: true });
const bundle = path.resolve('local-data/verify-title-aliases.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle });
const nativeFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  requests.push({ host: new URL(String(input)).host, status: response.status });
  return response;
};
const { resolveAnime } = await import(pathToFileURL(bundle).href);
const cases = [
  { title: 'スリピス', artist: '本田華子(CV:木野日菜), オリヴィア(CV:長江里加) & 野村香純(CV:小原好美)', expected: /Asobi Asobase/i },
  { title: 'Chikyugi - Spinning Globe', artist: 'Kenshi Yonezu', expected: /The Boy and the Heron/i },
];
const observations = [];
for (const { expected, ...song } of cases) {
  requests = [];
  const start = performance.now();
  try {
    const matches = await resolveAnime(song);
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: matches.some(match => expected.test(match.title) && match.matchKind === 'confirmed'), requests, matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: false, requests, error: String(error) });
  }
}
const report = { date: new Date().toISOString(), scope: 'Live full anime resolver with screenshot metadata; does not test audio recognition.', observations };
await writeFile('docs/TITLE_ALIAS_LIVE_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (observations.some(item => !item.passed)) process.exitCode = 1;
