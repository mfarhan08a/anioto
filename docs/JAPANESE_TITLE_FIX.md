# Japanese catalog spelling fix · v0.6.1

Reported recognition: **リテラチュア — Reina Ueda**. Song recognition succeeded; the reverse anime lookup failed. The production resolver preserves Unicode, but did not know that this Japanese title equals the catalog's **Literature**. A live exact-title AnisongDB query for リテラチュア returned zero rows; Literature returned one opening credit for **Wandering Witch: The Journey of Elaina**, AniList 112609. Artist discovery returned that credit too, but the local exact-title check correctly refused an unknown spelling equivalence.

The existing artist-specific verified alias registry now maps Literature / リテラチュア / Riterachua for Reina Ueda. Artist identity aliases include Reina Ueda / Ueda Reina / 上田麗奈. The official label announcement identifies リテラチュア as the opening theme: [Lantis announcement](https://www.lantis.jp/news.php?id=1595505597); [official anime news](https://majotabi.jp/news.html); [artist official site](https://reinaueda.lantis.jp/). AnisongDB supplies the Latin title and anime credit. This is an explicit spelling equivalence, not arbitrary translation or anime inference from artist alone.

The recognized song card retains its original Japanese text. Instrumental/version handling and artist verification remain active. Other artists and different songs do not inherit this alias. Dependencies, browser permissions, audio capture, and helper behavior are unchanged. This patch does not address the separate helper-busy condition.

## Evidence, 2026-11-03

- Four new regression cases failed before the fix and passed afterward. They cover Japanese/English/name-order artist spellings, instrumental versions, Japanese catalog artist credit, and negative unrelated-artist/title cases.
- All four browser packages build. Typecheck, ESLint, and **202 tests in 18 files** pass.
- The actual bundled production resolver was run against live catalogs, clearing its cache for every case. Results: Japanese title / Reina Ueda → confirmed; Japanese title / 上田麗奈 → confirmed; Riterachua (Instrumental) / Ueda Reina → version. Each used exactly one AnisongDB title request plus optional AniList artwork. First publication: 1691ms, 248ms, 594ms. These are individual metadata measurements, not end-to-end audio timings. [Raw results](JAPANESE_TITLE_LIVE_RESULTS.json); rerun with Node 22: `node scripts/verify-japanese-title.mjs`.

This fixes the reported song and verified spellings. It does not provide universal Japanese-to-romanized matching: other unlisted alternate titles, especially kanji readings and translated titles, can still miss. Automatically guessing translations can create wrong matches.

Native Edge reload/UI verification is pending; live tests above exercised production metadata code in Node, without recording or uploading audio.
