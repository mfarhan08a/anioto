# Onegai character-credit lookup · v0.6.2

User-reported song: **おねがい☆すにゃいぱー — 初瀬いづな(CV:沢城みゆき)**. The screenshot already shows successful audio recognition; the failure is in anime association lookup.

## Reproduction and source evidence

The unchanged production resolver returned `AnimeThemes is unavailable (HTTP 403)` in a live Node test. The user's earlier screenshot showed a fallback timeout; these are distinct observed fallback failures. Exact AnisongDB Japanese-title search returned zero records. A diagnostic partial Onegai search and the Miyuki Sawashiro artist catalog located **Onegai☆Snyaiper**, credited to **Miyuki Sawashiro**, for **No Game No Life**, **Opening 2**, AniList **19815**. The diagnostic partial search was used only for investigation, not added to the runtime request path.

The release's Japanese title and full character/voice credit appear in the [label-distributed Spotify track](https://open.spotify.com/track/0bRaIPC9P0Uz4oVD3QW5kr), with KADOKAWA copyright. The [official anime cast](https://ngnl.jp/staff-cast/) identifies 初瀬いづな as voiced by 沢城みゆき. These sources and the catalog credit establish the explicit spelling equivalence.

The existing verified registries now include that title pair and exact character/voice credit. The display retains the recognized Japanese text. No character-only guessing, album-name inference, universal CV stripping, new provider, permission or dependency was introduced. Wrong voice credits are not treated as confirmed; unrelated songs still fail exact-title verification. The separate helper-busy behavior is unchanged.

## Verification on 2026-11-03

- Three positive regression cases failed before the fix and passed afterward. Added cases also cover a wrong voice credit and a different song.
- All four browser targets build; TypeScript, ESLint, and **206 tests in 18 files** pass.
- Actual production resolver against live catalogs, fresh cache per case:

| Input | Result | First title publication | Including artwork |
| --- | --- | --- | --- |
| Exact Japanese title and character credit from screenshot | No Game, No Life · confirmed · Opening 2 | 852ms | 1222ms |
| Full-width parentheses/CV punctuation | Same confirmed result | 273ms | 570ms |
| Japanese instrumental title / Miyuki Sawashiro | Same anime · version | 272ms | 570ms |

Each case used one exact-title AnisongDB request plus optional AniList metadata. AnimeThemes was unnecessary. The test checks AniList ID 19815 and accepts AniList's display title comma. [Raw results](ONEGAI_LIVE_RESULTS.json); rerun with Node 22: `node scripts/verify-onegai.mjs`.

These are metadata tests, not new tab-audio or end-to-end recognition timings. The installed extension must be reloaded to use v0.6.2. Native UI reload was not performed during this test.
