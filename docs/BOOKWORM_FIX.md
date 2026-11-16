# Kamikazari TV-size lookup · v0.6.4

Reported input: **Kamikazari No Tenshi TV size ver. — Megumi Nakajima**. The screenshot's song recognition succeeded; the anime lookup failed.

The unchanged production resolver reproduced a fallback failure (AnimeThemes HTTP 403 here, timeout in the user's screenshot). Catalog inspection identified **Kami-kazari no Tenshi** for **Ascendance of a Bookworm**, Ending 1, AniList 108268. A literal Kamikazari prefix did not match the catalog's internal hyphen; the artist catalog revealed it. Diagnostic broad searches were not added to runtime.

The [official anime soundtrack page](https://booklove-anime.jp/season3/cd/d1.html) credits 髪飾りの天使 [TV-Size] to 中島 愛. The [record label](https://www.jvcmusic.co.jp/flyingdog/-/Discography/A021733/VTCL-35309.html) supplies Japanese/English artist identity. Those sources and the live catalog support the explicit title/artist aliases.

The parser now accepts an explicit trailing unbracketed **TV size ver.** / **TV-size version** / **TVサイズ ver.**, as well as the bracketed form. It does not strip unbracketed generic words such as Live or a standalone song title TV Size. Existing display text and artist verification are preserved. Title aliases link Kamikazari / Kami-kazari / 髪飾りの天使 only for the verified artist. No audio capture, permissions, dependencies or helper-busy behavior changed.

## Verification on 2026-11-03

- Five new targeted cases failed before the fix and passed afterward. Additional negative tests preserve standalone TV size ver., Theme TV size story, and Theme Live.
- All four browser targets build; typecheck, ESLint and **221 tests in 18 files** pass.
- Actual production resolver with fresh cache and live APIs:

| Input | Result | First title publication | Including artwork |
| --- | --- | --- | --- |
| Exact screenshot input | Ascendance of a Bookworm · Ending 1 · version | 772ms | 1248ms |
| Japanese title / Japanese artist / TVサイズ | Same anime and version | 390ms | 729ms |
| Full-length romanized title | Same anime · confirmed | 345ms | 663ms |

Every case used one exact-title AnisongDB request plus optional AniList artwork, without fallback. [Raw results](BOOKWORM_LIVE_RESULTS.json); reproduce with Node 22: `node scripts/verify-bookworm.mjs`.

These are metadata-only tests, not new audio capture or end-to-end timing measurements. Reload the installed extension to apply v0.6.4; native UI reload was not performed during this check.
