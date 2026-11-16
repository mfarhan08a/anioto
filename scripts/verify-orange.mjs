// Metadata-only check of the reported alternate release. No audio/key/page-title injection.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

await mkdir('local-data', { recursive: true });
const outfile = path.resolve('local-data/verify-orange.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => originalFetch(input, { ...init, headers: { ...init.headers, 'User-Agent': 'Mozilla/5.0 AnimeSongFinderVerification/0.3.2' } });
const { resolveAnime } = await import(pathToFileURL(outfile).href);
const observations = [];
for (const song of [
  { title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' },
  { title: 'Orange (Instrumental)', artist: 'seven oops' },
]) {
  const start = performance.now();
  try {
    const matches = await resolveAnime(song);
    const expectedKind = song.artist === 'seven oops' ? 'version' : 'possible';
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: matches.some(value => /Shigatsu wa Kimi no Uso|Your Lie in April/i.test(value.title) && value.matchKind === expectedKind), matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: false, error: String(error) });
  }
}
const result = { date: new Date().toISOString(), scope: 'Live anime metadata; supplied title/artist inputs, not audio recognition.', observations };
await writeFile('docs/ORANGE_RESOLVER_RESULTS.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (observations.some(value => !value.passed)) process.exitCode = 1;
