# v0.3.0 evidence — 2 November 2026

## Changed behavior

Audio recognition still supplies the recorded song title/artist. Metadata lookup now removes only explicit recording suffixes (bounded to two) and applies known title aliases to the base title. Exact credited artist matches rank above different-artist matches. Covers without a suffix can return possible underlying-song connections. Same-name collisions remain separate, explicitly possible, source-linked results rather than an arbitrary definitive answer.

The OP/ED catalog is supplemented with a small reviewed featured-song registry. Its first entry connects I Really Want to Stay At Your House to Cyberpunk: Edgerunners using [Netflix's official music video](https://www.youtube.com/watch?v=h4VJGNNSQnw). It is a featured song, not a claim the recording originated as an anime soundtrack. The registry is deliberately limited; arbitrary OST coverage is not promised.

The popup has three visible progress steps, a timed recording bar and indeterminate animated recognition/database bars. Reduced motion disables animation. Total and current-stage elapsed time update throughout a request; completed/cancelled/failed requests show a frozen total. Stored timestamps preserve timing when the popup reopens. Old results clear at a new job; recognized song details can appear while anime lookup continues without a premature no-match message.

## Automated checks

Build, typecheck and lint passed. All 76 tests passed. Generated-popup tests verify state transitions, terminal no-match rendering, stale async-result protection, history timing, indeterminate recognition, cancellation/failure cleanup and elapsed/frozen timers. Timer helpers verify progress advances with the persisted start time. The browser-style DOM in these tests is simulated; it is not a screenshot or a full browser test.

## Real metadata output

Reproduction: `node scripts/verify-live-resolver.mjs` (Node 22.12+ and internet access). The script sends only song fields, not audio or API keys. [Raw output](LIVE_RESOLVER_RESULTS.json):

| Input | Actual result | Duration |
|---|---|---|
| Sign (Live), FLOW | Naruto: Shippuden, version match; AnimeThemes credit FLOW, source link and AniList artwork | 23.596 s |
| Sign, Test cover performer | Naruto and other catalog songs named Sign, each labeled possible with original artists | 25.018 s |
| I Really Want to Stay At Your House, Rosa Walton & Hallie Coggins | Cyberpunk: Edgerunners, confirmed featured-song registry match | <1 ms |

The cover performer input is synthetic to exercise title-only fallback; the returned metadata was live. The Cyberpunk result is a reviewed bundled association, not a live OP/ED lookup. These checks test the resolver after song recognition, not audio recognition itself.

## Installed-browser verification

Native Edge reloaded the installed extension and confirmed v0.3.0. On the actual playing Netflix music video https://www.youtube.com/watch?v=KvMY1uzSC1E, clicked Identify this tab (no manual title entry). Observed the recording bar advance from 0 to 3 seconds, with active step labels and elapsed total/current-stage time. The local Shazam helper recognized I Really Want to Stay At Your House by Rosa Walton & Hallie Coggins, then the result displayed Cyberpunk: Edgerunners, a confirmed Featured song source entry, and frozen Total time: 0:18. The success was visible in the native accessibility tree and screenshots returned in the chat. This is actual tab-audio recognition, not the metadata-only script above.

The first active screenshot showed elapsed time too low in the popup, so the final layout puts it immediately below status and above the progress panel. The final build and 76 tests passed after that layout adjustment. A cover-recording browser test is being exercised separately.
