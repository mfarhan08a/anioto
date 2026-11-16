# Red Swan TV Edit / separated guest credit · v0.6.5

Input: **Red Swan - TV Edit - (feat. HYDE) — YOSHIKI**.

The unchanged parser removed the parenthesized guest credit but left **Red Swan - TV Edit -**. TV Edit was also absent from the version markers. The production resolver reproduced a fallback failure (HTTP 403 here; timeout in the screenshot).

The generic parser now accepts explicit TV Edit suffixes, bracketed or unbracketed. An optional dash separator is removed only together with a recognized trailing guest credit. Ordinary title dashes and unrelated parenthetical text remain intact. No song-specific alias, new database request, permission, dependency, audio change or helper-busy change was introduced. Artist checks and the original song-card text remain unchanged.

## Verification on 2026-11-03

- Six targeted cases failed before the fix and passed afterward. Additional negative cases preserve TV Edit as a standalone title, Love TV Edit Story, and ordinary title dashes/parentheses. Unrelated cover performers remain possible rather than confirmed.
- All four browser packages build; TypeScript, ESLint and **229 tests in 18 files** pass.
- Actual production resolver, fresh cache, live catalog tests:

| Input | Result | First anime publication | Total metadata time |
| --- | --- | --- | --- |
| Exact screenshot input | Attack on Titan Season 3 · Opening 1 · version | 1214ms | 2780ms |
| Red Swan (TV Edit) [ft. HYDE] | Same version match | 260ms | 653ms |
| Red Swan (feat. HYDE) | Same anime · confirmed | 292ms | 841ms |

All three returned AniList ID 99147 via one exact AnisongDB **Red Swan** request, followed by optional AniList metadata, without AnimeThemes fallback. Optional artwork was absent on the first run; the anime result remained available. [Raw results](RED_SWAN_EDIT_LIVE_RESULTS.json); reproduce with Node 22: `node scripts/verify-red-swan.mjs`.

This verifies the metadata path after recognized song details, not a new tab-audio recognition run. Reload the installed extension for v0.6.5; native reload was not performed during this test. Times are individual observations, not guarantees.
