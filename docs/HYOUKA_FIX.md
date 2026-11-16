# Mikansei Stride Japanese title / artist spelling · v0.7.3

Reported input: **未完成ストライド — Saori Kodama**. Song recognition succeeded; anime metadata resolution failed. The unchanged production resolver reproduced a fallback failure (HTTP 403 in this run, timeout in the screenshot).

AnisongDB returned no exact Japanese-title or Saori Kodama artist records. A diagnostic romanized-title search found **Mikansei Stride** / **Saori Codama**, **Hyouka**, **Opening 2**, AniList 12189. The [official anime release page](https://kotenbu.com/goods/cd_op2.html) and [Lantis release](https://www.lantis.jp/release-item/LACM-4955.html/1000) credit 未完成ストライド to こだまさおり as Hyouka's new opening theme. These and the live catalog underpin explicit title/artist equivalence; no fuzzy artist guessing was added.

Existing verified registries now link the Japanese/romanized title and Saori Kodama / Saori Codama / こだまさおり artist spellings. Original recognized text remains displayed. Other performers remain possible rather than confirmed, and unrelated song titles still fail exact verification. No permissions, dependencies, capture, UI sizing, or helper behavior changed.

## Verification · 2026-11-04

- Three positive regression cases failed before the fix and passed afterward; additional negative artist/title assertions pass.
- All four packages build, types and lint pass; **243 tests in 18 files** pass.
- Actual bundled production resolver, fresh cache, live catalog:

| Input | Result | First anime publication | Total metadata time |
| --- | --- | --- | --- |
| Exact screenshot input | Hyouka · Opening 2 · confirmed | 848ms | 2384ms |
| Japanese title and Japanese artist | Same confirmed result | 617ms | 1777ms |
| Romanized title / catalog's Saori Codama spelling | Same confirmed result | 530ms | 1320ms |

Each sent one exact **Mikansei Stride** AnisongDB query, plus optional AniList metadata, without fallback. Artwork was absent after the optional enrichment budget on the first run; the confirmed title remained available. [Raw results](HYOUKA_LIVE_RESULTS.json). Reproduce with Node 22: `node scripts/verify-hyouka.mjs`.

These are metadata tests using already-recognized song details, not new browser audio recognition. Reload the installed extension to apply v0.7.3. This adds verified spellings for this song; it does not claim universal translation of Japanese song titles.
