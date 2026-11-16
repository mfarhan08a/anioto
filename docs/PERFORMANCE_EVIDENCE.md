# Instrumental matching and latency — 2 November 2026 — v0.3.1

## Correctness

The supplied recognized song, **Akane Sasu (instrumental)** by **Aimer**, now resolves to **Natsume Yuujinchou Go (Natsume's Book of Friends Season 5), ED**. This is not a manually bundled anime answer: the resolver strips a bounded, explicit arrangement suffix, then requires the actual catalog's song/artist/theme relationship. [The official Natsume announcement](https://www.natsume-anime.jp/news/1446?category=info_music) confirms the ending credit and lists the instrumental track on the same single.

The arrangement parser also handles off-vocal, karaoke, TV-size labels, and full-width brackets. Japanese 茜さす and Akanesasu are artist-specific aliases for the catalog's Akane Sasu title. Literal title words are preserved. Unknown cover artists still receive possible labels, including in progress and final status.

## Latency changes

- Local Shazam capture is 12 seconds instead of 15. The helper already used at most 12 seconds, so the fingerprint analysis duration is unchanged. AudioTag and diagnostic previews remain 15 seconds. The progress counter uses the actual selected duration.
- A source-backed anime title is published as soon as the catalog match arrives, before optional English-title/artwork requests.
- Optional enrichment uses up to three concurrent chains and a 1.5-second shared deadline. A missing cover never suppresses an anime match. Covers and English titles may be absent when their services are slow.
- Successful metadata results are cached in the offscreen process for one hour, bounded to 100 songs. No empty results or provider errors are cached. Returned results are cloned. Reloading/closing that process clears the cache. Audio is still recognized afresh; the cache does not guess the current song.

## Measured live metadata result

[Raw output](PERFORMANCE_RESULTS.json), produced by `node scripts/benchmark-resolver.mjs` on this Windows machine with Node 22.23.4 and the current network connection. No audio, key, mocked API response or saved personal override was used. Both paths use the corrected instrumental normalization so the comparison measures lookup behavior, not a broken-title query against a fixed one.

| Path | First anime title | Lookup finished | Network requests |
|---|---:|---:|---:|
| Before: sequential enrichment, no cache | 21.210 s | 21.210 s | 3 |
| After: cold lookup, bounded enrichment | 5.467 s | 6.985 s | 2 |
| After: warm lookup | <1 ms | <1 ms | 0 |

This is one sample per condition, not an accuracy/performance distribution. Network conditions vary and connection reuse may affect the comparison. These are metadata-only durations; capture and recognition time are additional. The original old resolver snapshot used by this local comparison remains under ignored local-data; without that snapshot the script benchmarks only the new path.

## Verification

Build, TypeScript, ESLint, and all **100 tests** passed. Imported-module coverage: statements 84.65%, lines 91.21%, branches 75.75%, functions 84.29%. Tests include the exact supplied English metadata, Japanese/full-width variants, literal-title protections, early publication despite a non-cooperative hanging artwork fetch, cache hit/expiration/mutation boundaries, cancellation, no negative/error caching, local 12-second capture, duration-specific progress, and possible-only status copy.

### Native Edge observations

Reloaded the existing installed extension and confirmed v0.3.1, then played [Aimer's official instrumental](https://www.youtube.com/watch?v=dkVLiDWCCtU&t=60s). The actual toolbar Identify action showed an advancing 12-second recording bar and elapsed timer, and the local helper returned Akane Sasu (instrumental), Aimer, Akane Sasu / Everlasting Snow - EP.

The first browser metadata request timed out after 25 seconds (40-second total request); this is a real observed cold-network failure and is not hidden by the successful benchmark. Opening the same public catalog URL directly in Edge subsequently returned the song and Natsume Yuujinchou Go credit. A subsequent identification displayed **Song and anime associations found**, **Natsume Yuujinchou Go**, **Version match · ED**, and the AnimeThemes source link with frozen **Total time: 0:25**. User input occurred between these checks, so this successful retry is an observed installed-browser result, not claimed as an exclusively agent-operated journey.

A fresh agent-operated repeat identification then succeeded in **Total time: 0:14**, including a new actual 12-second tab capture and local recognition. The final popup showed **Akane Sasu (instrumental)**, **Aimer**, **Natsume Yuujinchou Go**, **Version match · ED**, and the source link. This was the toolbar Identify action, not manual song lookup or an injected response. Metadata was already cached by the successful preceding run; the audio recognizer still ran again. The final native screenshot shows the song, anime, source evidence and frozen 14-second total together. The command-line timing comparison above is metadata-only; the cold browser observations show why a universal latency guarantee would be misleading. Native screenshots and accessibility text are visible in this chat's tool output.
