# Sakurasou TV-size / mixed credit fix · v0.6.3

Reported input: **君が夢を連れてきた(TVサイズ)** / **Ai Kayano, 中津真莉子 & Natsumi Takamori**.

The unmodified production resolver failed with an AnimeThemes HTTP 403 during reproduction; the user's screenshot showed a fallback timeout. AnisongDB returned no Japanese-title records, but a diagnostic romanized prefix search located **Kimi ga Yume o Tsuretekita** / **Pet na Kanojo-tachi** for **The Pet Girl of Sakurasou**, Opening 1, AniList 13759. Runtime queries remain exact, without that diagnostic partial search.

The [official release announcement](https://sakurasou.tv/news/archives/120903_oped.html) names the song, anime, and complete trio (茅野愛衣、中津真莉子、高森奈津美). The [lyricist's official work record](https://akihata.jp/works/music/7795/) corroborates the song and group. Live AnisongDB group membership supplies Latin spellings Ai Kayano, Mariko Nakatsu, and Natsumi Takamori.

Changes reuse the existing registries: verified Japanese/romanized title equivalence and the complete trio/group credit. The generic TV version suffix parser now also accepts `TVサイズ`, including full-width input and a space after TV. It strips that explicit trailing version marker only; the song card preserves the supplied text. Solo members, incomplete lineups, and unrelated cover artists are not treated as the original group. No audio code, permissions, dependencies or provider budgets changed; the separate helper-busy issue is unchanged.

## Verification on 2026-11-03

Seven new regression tests failed before implementation and passed afterward: three complete group credits, negative partial/solo/cover cases, and three Japanese TV-size suffix spellings.

All four packages build, typecheck and ESLint pass. Full suite: **213 tests in 18 files passed**.

Actual production resolver, live APIs, fresh cache per case:

| Input | Result | First anime title | Total metadata time |
| --- | --- | --- | --- |
| Exact screenshot input | The Pet Girl of Sakurasou · Opening 1 · version | 454ms | 1902ms |
| Full-width TV-size / Japanese group name | Same anime and version | 249ms | 562ms |
| Romanized title / complete English trio | Same anime · confirmed | 254ms | 573ms |

Each uses one AnisongDB exact-title request plus optional AniList artwork, without AnimeThemes fallback. The metadata-only test validates AniList ID 13759. [Raw results](SAKURASOU_LIVE_RESULTS.json); reproduce using Node 22: `node scripts/verify-sakurasou.mjs`.

No new tab-audio test was performed: the screenshot already contains successful song recognition, and this patch targets the subsequent lookup. Reload the installed extension to apply v0.6.3. These individual timing observations are not recognition-speed guarantees.
