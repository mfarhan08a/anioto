# Recurring anime lookup failures: root causes and shared fixes

Analyzed 23 November 2026 against release commit `5f0615b` and the earlier
development cases. Audio recognition and anime credit lookup are separate stages:
both supplied screenshots already contain a recognized song. Their failure is in
metadata discovery, followed by an AnimeThemes HTTP 503 response.

## Findings

| Failure pattern | Root cause | Shared change |
| --- | --- | --- |
| Japanese voicing/punctuation | NFKD decomposes ガ into カ plus a combining mark; the subsequent non-letter filter removed that mark. | Recompose Japanese characters before filtering punctuation, while retaining Latin accent folding. |
| Kana versus romaji | Local normalization only compared the same script. | Use bundled WanaKana for kana/romaji comparison; no remote translation or new host permission. |
| Different separators and word boundaries | An exact server query can return zero rows before local normalization ever sees the right credit. | After strict title and artist discovery, try at most three additional bounded discovery queries in parallel; validate full titles locally. The existing four-second primary deadline still applies. |
| Cast lists, CV credits, reordered performers | Release credit strings were compared as a single artist name. Group member metadata was ignored. | Parse explicit CV credits and compare the complete performer set against source aliases or the complete source group lineup. A solo member or extra uncredited performer cannot become the group. Flattened individual artist aliases no longer confirm a whole cast for one singer; explicit lead/featured credits remain supported. |
| Same song used by several anime | `ignore_duplicate: true` asks AnisongDB to discard cross-anime uses. | Request all associations and deduplicate by anime ID locally. |
| Valid phonetic match rejected as ambiguous | The old spacing check counted anime results, not competing song spellings. | Permit several anime using the same credit, while still rejecting competing normalized titles. |
| Repeated per-song registry fixes obscure discovery | Some reviewed supplemental credits returned before the live catalog was consulted. | Query the live catalog first. Existing reviewed evidence remains a fallback for misses/outages; it cannot hide additional live associations. |
| Every new miss appears broken when the backup is down | A missing primary match falls through to an unavailable AnimeThemes service. | Report the primary miss separately from the backup error. After HTTP 503, briefly pause backup requests for 30 seconds; keep querying the primary and never cache an outage as a definitive negative result. |

The provider's duplicate behavior is documented in the
[AnisongDB source README](https://github.com/kempanator/AnisongDB#advanced-filters).
The kana conversion boundary is documented by
[WanaKana](https://wanakana.com/docs/global.html#toRomaji).

## Why some previous exceptions remain data

Translations, kanji readings, composer-versus-performer relationships, and
recording-specific cover credits cannot safely be derived from spelling alone.
Existing reviewed aliases and official-source supplemental credits are retained
for compatibility and real catalog gaps. This change adds **no song-specific
production aliases or anime associations**. New title/artist/anime literals appear
only in tests and verification evidence.

## The two supplied screenshots are still unresolved

- `アキハバラ☆だんす☆なう!!`: the catalog has `Akihabara☆Dance☆Now!!`, credited to
  Ayana Taketatsu, Kana Hanazawa, and Hitomi Nabatame for Oreimo. The recognized
  artist field is instead the anime/release name. Kana conversion gives
  `akihabara dansu nau`, which is not the catalog's English loanword spelling.
- `らぶりぃでびる`: the catalog has `Lovely♥Devil`, credited to
  `Occult Kenkyuu-bu Girls` for High School DxD New. Its source group metadata
  includes the six performers, but their catalog names are Latin, while the
  recognized credits contain Japanese character/actor names. Kana conversion
  does not translate Lovely/Devil or determine those kanji readings.

Neither case is claimed fixed. Broad English loanword substitutions, inferring an
anime from its actor alone, or choosing the first partial-title result would risk
incorrect associations. These require a source-backed multilingual recording/work
identity bridge, not another forced anime route. Read-only MusicBrainz and iTunes
probes did not supply a usable general bridge for both cases; no such service was
added to production.

## Verification

- Build for Edge, Chrome, Firefox, Safari; typecheck; lint: passed.
- 424 tests across 27 files: passed; statement coverage 87.19%, line coverage 93.75%.
- All 32 earlier live metadata regression cases passed with the updated full resolver; see GENERAL_REGRESSION_LIVE_RESULTS.json.
- Three previously unseen kana inputs had **zero** matches before the change and
  resolve correctly afterward: DEEN's `ひとりじゃない` (Dragon Ball GT), Megumi
  Hayashibara's `サクラサク` (three Love Hina entries), and ClariS's `ヒトリゴト`
  (two Eromanga Sensei entries). Live primary lookup took about 0.5–1.0 seconds.
- The two new screenshot cases remain explicitly marked as unresolved in the evidence.
- Dependency audit: no high/critical advisories; six existing moderate advisories.

See [before/after evidence](GENERAL_DISCOVERY_LIVE_RESULTS.json). Run
`node scripts/verify-general-discovery.mjs` to repeat current live metadata tests.
This tests metadata resolution, not browser capture or SongRec/Shazam recognition.
WanaKana 5.3.1 is bundled under MIT; every browser build includes its license.

The existing dependency tree has an unrelated install issue: `@humanfs/node`
requires `@humanwhocodes/retry ^0.8.0`, which the registry did not resolve. WanaKana
was resolved independently with npm and its generated integrity/lock entry was
merged without changing other dependency versions. Fresh dependency installation
was not verified; the installed dependency tree passed the checks above.

The submitted 0.10.6 store archive remains immutable. This work is on the
`fix/generalized-credit-discovery` branch and in the rebuilt local development
folders; it is not yet a new Edge store submission.
