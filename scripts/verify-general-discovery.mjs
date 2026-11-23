// Read-only live metadata verification. Never captures audio or uses recognition credits.
// Optional --baseline compares a source snapshot extracted into local-data/baseline-general.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('local-data', { recursive: true });
const cases = [
  { title: 'ひとりじゃない', artist: 'DEEN', expectedIds: [225] },
  { title: 'サクラサク', artist: 'Megumi Hayashibara', expectedIds: [189, 191, 192] },
  { title: 'ヒトリゴト', artist: 'ClariS', expectedIds: [21685, 100523] },
  // These fixtures must remain unresolved until a metadata source proves their
  // translated title/credit equivalence. Do not turn the fixtures into production aliases.
  { title: 'アキハバラ☆だんす☆なう!!', artist: 'Oreno Imoutoga Konnani Kawaii Wakeganai', expectedIds: [], limitation: 'Translated loanwords; release credit is the anime name.' },
  { title: 'らぶりぃでびる', artist: 'オカルト研究部ガールズ, リアス・グレモリー(CV:日笠陽子), 姫島朱乃(CV:伊藤 静), アーシア・アルジェント(CV:浅倉杏美), 塔城小猫(CV:竹達彩奈), ゼノヴィア(CV:種田梨沙) & ギャスパー・ヴラディ(CV:佐倉綾音)', expectedIds: [], limitation: 'Translated loanwords and Japanese group/actor credits.' },
];
const report = { date: new Date().toISOString(), scope: 'Live AnisongDB metadata only; not browser audio recognition. Empty expectedIds record unresolved cases, not recognition successes.', runs: [] };
for (const variant of [...(process.argv.includes('--baseline') ? ['baseline'] : []), 'current']) {
  const bundle = path.resolve(`local-data/general-${variant}.mjs`);
  await build({ entryPoints: [variant === 'baseline' ? 'local-data/baseline-general/src/providers/anisongdb.ts' : 'src/providers/anisongdb.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle });
  const { resolveAnisongDB } = await import(pathToFileURL(bundle).href);
  const observations = [];
  for (const { expectedIds, limitation, ...song } of cases) {
    const start = performance.now();
    try {
      const matches = await resolveAnisongDB(song);
      observations.push({ song, expectedIds, ...(limitation ? { limitation } : {}), elapsedMs: Math.round(performance.now() - start), matches,
        passed: JSON.stringify(matches.map(match => match.id).sort((a, b) => a - b)) === JSON.stringify([...expectedIds].sort((a, b) => a - b)),
      });
    } catch (error) { observations.push({ song, expectedIds, error: String(error), passed: false }); }
  }
  report.runs.push({ variant, observations });
}
await writeFile('docs/GENERAL_DISCOVERY_LIVE_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
for (const run of report.runs) console.log(JSON.stringify({ variant: run.variant, cases: run.observations.map(item => ({ title: item.song.title, expectedIds: item.expectedIds, foundIds: item.matches?.map(match => match.id), elapsedMs: item.elapsedMs, passed: item.passed, error: item.error })) }));
if (report.runs.find(run => run.variant === 'current').observations.some(item => !item.passed)) process.exitCode = 1;
