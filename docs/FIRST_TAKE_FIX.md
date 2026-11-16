# THE FIRST TAKE recording suffix · v0.7.2

Input: **Akuma no Ko - From the First Take — Ai Higuchi**. Audio recognition succeeded in the user's screenshot; the subsequent metadata lookup failed. The unchanged production resolver reproduced an AnimeThemes HTTP 403 fallback failure; the screenshot showed a fallback timeout.

AnisongDB's original-song credit is **Akuma no Ko** / **Ai Higuchi**, Ending 1, linked to AniList **131681**. AniList enrichment titles that anime **Attack on Titan Final Season Part 2**.

The bounded version-marker parser now recognizes a trailing **From THE FIRST TAKE** or **THE FIRST TAKE**, separated by a dash or enclosed in brackets/parentheses. This applies generally to session recordings, without a song-specific alias or additional request. Existing display titles, artist verification and match classification are retained. Cover performers remain possible connections, not confirmed. Ordinary standalone or longer titles containing those words are preserved. No audio, UI sizing, permissions, dependencies or helper-busy behavior changed.

## Verification · 2026-11-04

- Five targeted cases failed before implementation and passed afterward. Three additional negative title cases pass.
- All four browser packages build; TypeScript, ESLint and **239 tests in 18 files** pass.
- Actual bundled production resolver, live metadata, fresh cache per case:

| Input | Result | First anime publication | Total metadata time |
| --- | --- | --- | --- |
| Exact screenshot input | Attack on Titan Final Season Part 2 · Ending 1 · version | 429ms | 1838ms |
| Parenthesized From THE FIRST TAKE | Same version match | 258ms | 553ms |
| Original Akuma no Ko title | Same anime · confirmed | 416ms | 707ms |

Each used one exact-title AnisongDB request plus optional AniList metadata/artwork; no fallback request was necessary. [Raw evidence](FIRST_TAKE_LIVE_RESULTS.json). Reproduce using Node 22: `node scripts/verify-first-take.mjs`.

These tests exercise the metadata path with the already-recognized song details, not a new browser audio run. Reload the installed extension to apply v0.7.2. The explicit popup-height fix from v0.7.1 is retained.
