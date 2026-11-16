import { writeFile } from 'node:fs/promises';
const observations = [];
for (let round = 1; round <= 3; round++) {
  const start = performance.now();
  const requests = [];
  let match;
  for (const filter of [
    { song_name_search_filter: { search: 'Yuki no Oto', partial_match: false } },
    { artist_search_filter: { search: 'Novelbright', partial_match: false } },
  ]) {
    const began = performance.now();
    const response = await fetch('https://anisongdb.com/api/search_request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...filter, ignore_duplicate: true }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    requests.push({ filter, elapsedMs: Math.round(performance.now() - began), count: rows.length });
    // Benchmark validation uses the expected ID. A production resolver must verify
    // title aliases; the artist alone is not evidence of which anime is correct.
    match = rows.find(row => row.linked_ids?.myanimelist === 55866);
    if (match) break;
  }
  observations.push({ round, elapsedMs: Math.round(performance.now() - start), requests, expectedCatalogEntry: match ? { song: match.songName, artist: match.songArtist, anime: match.animeENName, malId: match.linked_ids.myanimelist } : null });
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await writeFile('docs/ALTERNATIVE_FALLBACK_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), scope: 'Metadata only; exact recognized title then artist discovery. Expected anime ID validates benchmark coverage, not an implemented production matching algorithm.', observations }, null, 2) + '\n');
console.log(JSON.stringify(observations));
