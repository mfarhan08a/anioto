// Live metadata benchmark; never captures audio, reads keys, or mocks responses.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('local-data', { recursive: true });
const outputs = [];
if (existsSync('local-data/anime-before-performance.ts')) {
  const outfile = path.resolve('local-data/benchmark-before.mjs');
  await build({ stdin: { contents: await readFile('local-data/anime-before-performance.ts', 'utf8'), resolveDir: path.resolve('src/providers'), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile });
  outputs.push({ label: 'before: sequential enrichment, no cache (instrumental normalization held constant)', outfile });
}
const outfile = path.resolve('local-data/benchmark-after.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, format: 'esm', platform: 'node', outfile });
outputs.push({ label: 'after: title-first, bounded enrichment, cache', outfile });
const request = globalThis.fetch;
let requests = 0;
globalThis.fetch = (input, init = {}) => {
  requests++;
  return request(input, { ...init, headers: { ...init.headers, 'User-Agent': 'Mozilla/5.0 AnimeSongFinderVerification/0.3.1' } });
};
const song = { title: 'Akane Sasu (instrumental)', artist: 'Aimer' };
const observations = [];
for (const output of outputs) {
  const { resolveAnime } = await import(pathToFileURL(output.outfile).href);
  for (const run of output.label.startsWith('after') ? ['cold', 'warm'] : ['cold']) {
    requests = 0;
    const start = performance.now();
    let firstTitleMs;
    try {
      const matches = await resolveAnime(song, undefined, () => { firstTitleMs ??= Math.round(performance.now() - start); });
      const completeMs = Math.round(performance.now() - start);
      observations.push({ resolver: output.label, run, firstTitleMs: firstTitleMs ?? completeMs, completeMs, requests, passed: matches.some(match => /Natsume/i.test(match.title) && match.matchKind === 'version'), matches });
    } catch (error) {
      observations.push({ resolver: output.label, run, completeMs: Math.round(performance.now() - start), requests, passed: false, error: String(error) });
    }
  }
}
const result = { date: new Date().toISOString(), song, scope: 'Metadata only; Node 22 on this Windows machine over the current connection. One sample per condition; network latency varies. Before/after both use the corrected instrumental normalization. Warm cache lives only in the offscreen process.', observations };
await writeFile('docs/PERFORMANCE_RESULTS.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (observations.some(item => !item.passed)) process.exitCode = 1;
