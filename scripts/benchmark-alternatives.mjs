// Live public metadata only. Jikan gets a known anime ID: verification, not reverse lookup.
import { writeFile } from 'node:fs/promises';
const cases = [
  { song: 'Orange', artist: 'seven oops', animeId: 23273, expected: /Shigatsu wa Kimi no Uso|Your Lie in April/i },
  { song: 'Akane Sasu', artist: 'Aimer', animeId: 32983, expected: /Natsume.*Go|Natsume.*5/i },
  { song: 'Yuki no Oto', artist: 'Novelbright', animeId: 55866, expected: /Yubisaki to Renren|A Sign of Affection/i },
];
const observations = [];
async function measure(provider, item, round) {
  const url = provider === 'AnisongDB' ? 'https://anisongdb.com/api/search_request' : `https://api.jikan.moe/v4/anime/${item.animeId}/themes`;
  const request = provider === 'AnisongDB' ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ song_name_search_filter: { search: item.song, partial_match: false, match_case: false }, ignore_duplicate: true }) } : {};
  const start = performance.now();
  let observation;
  try {
    const response = await fetch(url, { ...request, signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    const elapsedMs = Math.round(performance.now() - start);
    let payload;
    try { payload = JSON.parse(body); } catch { /* Error pages are recorded as invalid JSON. */ }
    const candidates = provider === 'AnisongDB' && Array.isArray(payload) ? payload.map(row => ({ anime: row.animeENName, animeJP: row.animeJPName, song: row.songName, artist: row.songArtist, type: row.songType, malId: row.linked_ids?.myanimelist })) : [];
    const themes = provider === 'Jikan' ? payload?.data : undefined;
    const expectedAnimeFound = candidates.some(row => row.malId === item.animeId || item.expected.test(`${row.anime} ${row.animeJP}`));
    observation = { provider, round, song: item.song, artist: item.artist, url, requestBody: request.body ? JSON.parse(request.body) : undefined, status: response.status, elapsedMs, bytes: Buffer.byteLength(body), validResponse: response.ok && (provider === 'AnisongDB' ? Array.isArray(payload) : Array.isArray(themes?.openings) && Array.isArray(themes?.endings)), expectedAnimeFound: provider === 'AnisongDB' ? expectedAnimeFound : undefined, suppliedAnimeId: provider === 'Jikan' ? item.animeId : undefined, candidates: provider === 'AnisongDB' ? candidates : undefined, themes, error: !response.ok ? body.slice(0, 300) : undefined };
  } catch (error) {
    observation = { provider, round, song: item.song, elapsedMs: Math.round(performance.now() - start), validResponse: false, error: String(error), cause: error.cause?.code ?? error.cause?.message };
  }
  observations.push(observation);
  console.log(JSON.stringify({ ...observation, candidates: observation.candidates?.length, themes: undefined, requestBody: undefined }));
}
async function save() {
  const summary = ['AnisongDB', 'Jikan'].map(provider => {
    const all = observations.filter(row => row.provider === provider);
    const valid = all.filter(row => row.validResponse);
    const times = valid.map(row => row.elapsedMs).sort((a,b) => a-b);
    const middle = Math.floor(times.length / 2);
    return { provider, attempts: all.length, validResponses: valid.length, failures: all.length - valid.length, medianSuccessMs: times.length ? (times[middle] + times[Math.floor((times.length-1)/2)]) / 2 : null, minSuccessMs: times[0] ?? null, maxSuccessMs: times.at(-1) ?? null, expectedAnimeHits: provider === 'AnisongDB' ? valid.filter(row => row.expectedAnimeFound).length : undefined };
  });
  await writeFile('docs/ALTERNATIVE_PROVIDER_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), scope: 'Client-observed full HTTP response + body; Node 22 on user computer, no app cache; metadata only, no audio or recognition credits. Jikan is given the expected anime ID and cannot perform this reverse lookup itself. Three sequential rounds, providers in parallel per song, 1-second spacing. HTTP connection/provider cache may be reused. 15-second timeout.', summary, observations }, null, 2) + '\n');
}
for (let round = 1; round <= 3; round++) {
  for (const item of cases) {
    await Promise.all([measure('AnisongDB', item, round), measure('Jikan', item, round)]);
    await save();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
