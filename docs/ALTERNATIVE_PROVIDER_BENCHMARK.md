# Alternative anime-song provider benchmark

Measured on 2026-11-02 (Asia/Bangkok), from the user's computer with Node 22. Public metadata requests only: no captured audio, API keys, or recognition credits. Extension runtime/provider selection is unchanged.

## Results

| Provider | Valid responses | Median successful full response | Range | Outcome |
| --- | --- | --- | --- | --- |
| AnisongDB | 9/9 | 328 ms | 305–427 ms | Usable song-to-anime search |
| Jikan | 0/9 | Not measurable | Connection failures after 10.507–10.566 seconds | `UND_ERR_CONNECT_TIMEOUT` from this computer |

Jikan was given the known anime ID for each request. Its `/v4/anime/{id}/themes` endpoint verifies theme credits for an already-known anime; it is not a reverse song-to-anime search. Connection failures are not successful response times and do not prove Jikan is globally slow or down.

Three rounds per song, providers requested concurrently per song, with one-second spacing between pairs. Each provider therefore received sequential requests. Timing covers fetching and reading the complete HTTP response, not audio recording/recognition or artwork enrichment. No application cache; HTTP connections and upstream caches can be reused. This is a small local benchmark, not a service-level guarantee. Pilot requests preceded the final run; these are not guaranteed cold-cache timings.

## Accuracy and spelling

- `Orange`: 10 candidate records, including `Orange — 7!! — Your Lie in April`, Ending 2, MAL 23273. Shared song names still need artist verification.
- `Akane Sasu`: one record, `Aimer — Natsume's Book of Friends Season 5`, Ending 1, MAL 32983.
- `Yuki no Oto`: zero exact-title records. Artist search for `Novelbright` returned seven songs, including `Yuki no Ne — A Sign of Affection`, MAL 55866. The production resolver would need a verified title alias to select this record, rather than selecting an arbitrary song by the artist.

Thus the exact-title search found the expected anime for two of the three songs (6/9 repeated requests). Three additional two-request discovery runs (title miss followed by artist search) found the Novelbright catalog entry in 1,038 / 514 / 483 ms total; median 514 ms. Validation used the known expected ID, which is not a substitute for production matching logic.

Instrumental and cover-title normalization was not implemented or tested in this benchmark. Existing resolver logic would need to be connected and tested against this provider before switching the extension.

## Recommendation

AnisongDB is the best primary lookup candidate on this connection: fast, functional, and able to search by song or artist. Retain verified aliases, artist matching, and clearly labeled possible cover associations. Keep AnimeThemes as a bounded fallback and AniList for optional artwork/metadata. Jikan is a possible verification source when reachable, rather than a primary reverse lookup provider.

## Reproduce and inspect

Run with Node 22 from the project root:

```text
node scripts/benchmark-alternatives.mjs
node scripts/benchmark-anisong-fallback.mjs
```

Raw evidence: `docs/ALTERNATIVE_PROVIDER_RESULTS.json` and `docs/ALTERNATIVE_FALLBACK_RESULTS.json`.

Provider references:
- https://github.com/xSardine/AMQ-Artists-DB/blob/main/backEnd/README.md
- https://github.com/xSardine/AMQ-Artists-DB/blob/main/backEnd/app/schemas.py
- https://docs.api.jikan.moe/
