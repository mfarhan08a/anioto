# Featured-credit and translated-title fix — v0.5.1

Date: 2026-11-02.

## Behavior

Trailing featured-artist metadata such as `(feat. HYDE)`, `[ft. HYDE]`, and `featuring HYDE` is omitted from the title used for catalog lookup. The original recognized/displayed song is unchanged. A guest credit alone is not classified as a live/instrumental recording version. Existing recording suffixes and guest credits work in either order.

Artist confirmation still requires the catalog's actual artist/alias credits. A title match by an unrelated cover performer remains possible, never automatically confirmed. Ordinary parentheses, incomplete `feat.` credits, meaningful title words, and unhandled remix labels are preserved.

Added the artist-specific translated-title alias `Music Train` / `Uta no Kisha` / `うたのきしゃ` for Tatsuro Yamashita. It only normalizes a song title; the live catalog must still document the anime connection. It does not infer an anime from the album name or grant the alias to unrelated performers.

## Validation

- All four browser bundles built at **0.5.1**; types and source lint passed.
- **173 tests / 16 test files passed**. Imported-module coverage: 86.79% statements, 92.92% lines, 77.81% branches, 87.57% functions.
- Live bundled production resolver: **Red Swan (feat. HYDE) — YOSHIKI → Attack on Titan Season 3**, confirmed match, initial title delivered in 1,598 ms and complete with optional metadata in 2,035 ms.
- Live bundled production resolver: **Music Train (Karaoke) — Tatsuro Yamashita → Mirai**, version match, initial title delivered in 403 ms and complete in 1,191 ms.
- Six prior examples also passed in the same run. Raw observations: `TITLE_CREDIT_LIVE_RESULTS.json`.
- These are live metadata tests with supplied recognized title/artist pairs, not new native audio-capture tests. Browser capture and cross-browser test limitations remain as documented separately. Reload the installed unpacked extension to use the new bundles, then start a new search; the last stored result is not recomputed automatically.
- Audit: no high/critical advisories; ten existing moderate development-tool advisories. No dependencies or browser permissions changed in this patch.

## Sources

- HYDE's official credit for YOSHIKI feat. HYDE and Attack on Titan Season 3: https://www.hyde.com/contents/5809 and https://www.hyde.com/contents/5865
- Tatsuro Yamashita's official Japanese song/film credit: https://www.tatsuro.co.jp/discography/single.php
- Mirai production notes credit the English title Music Train: https://fetch.fm/media/uploads/production-notes/2018/09/06/12/27/MIRAI_Production_Notes.pdf
- Live AnisongDB records were requested through https://anisongdb.com/api/search_request . Red Swan returns YOSHIKI and HYDE as individual artist credits; Uta no Kisha returns Tatsuro Yamashita and Mirai.
