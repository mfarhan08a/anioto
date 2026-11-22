# Reported metadata failures — 22 November 2026

The audio recognizer had already returned song details in all six screenshots.
AnisongDB responded successfully during reproduction. Its records use different
titles or credit roles, so the resolver rejected candidates and invoked
AnimeThemes. The displayed HTTP 503 came from that fallback.

| Recognized metadata | Cause | Fix | Live anime result |
| --- | --- | --- | --- |
| Pino To Ameri (Anime Size) | Unsupported version suffix and Ameri/Amélie spelling difference | Shared explicit Anime Size suffix handling plus an artist-scoped title alias | Naruto: Shippuden |
| 花咲み / シルフィエット(CV:茅野愛衣) | Japanese title and character credit versus Hanaemi / Ai Kayano | Verified title and song-specific character/actor aliases | Mushoku Tensei: Jobless Reincarnation Season 2 |
| 終ワリノ歌 / Kenichiro Suehiro | Japanese title and soundtrack composer versus Owari no Uta / MAYUKO & Luminous | Verified title and song-specific release-credit aliases | Girls' Last Tour |
| 幻想の輪舞 | Japanese title versus Gensou no Rondo | Artist-scoped title alias | Grisaia: Phantom Trigger the Animation |
| TVアニメ「…」エンディング・テーマ「ちいさな冒険者 (TV-size)」 | The anime-credit prefix was included in the search; Japanese title and trio punctuation also differ | Shared anchored prefix extraction, title alias, and complete-trio credit equivalence | KONOSUBA -God's blessing on this wonderful world! |
| Tada Yowai Dakejanakute Bokurawa - NARUTO Syonenhen Version | Joined words and a release-specific version suffix | Artist-scoped title and recording aliases | Naruto |

The shared parser changes preserve ordinary title words and reject incomplete
credit wrappers. The aliases do not contain anime IDs or anime titles; anime
associations, credits, and artwork still come from live AnisongDB and AniList.
The composer equivalence is limited to Owari no Uta. A solo Konosuba member is
not equivalent to the complete trio. Unknown performers cannot become confirmed
matches through these aliases.

This does not repair AnimeThemes' availability or provide automatic translation
of every unknown Japanese song. It avoids that fallback for these verified
metadata variants.

## Sources

- [Pino to Amélie release](https://www.sonymusic.co.jp/artist/ishizakihuwie/info/471355)
- [Mushoku Tensei official music credits](https://mushokutensei.jp/music/)
- [Girls' Last Tour official soundtrack track list](https://girls-last-tour.com/products/music.html)
- [Label-distributed Owari no Uta composer credit](https://www.youtube.com/watch?v=67STFqbZxTM)
- [Gensou no Rondo label release](https://nbcuni-music.com/maon/contents/hp0007/index00290000.html)
- [Konosuba label track and trio credits](https://columbia.jp/prod-info/COCC-17103/)
- [Mass Alert release](https://www.sonymusic.co.jp/artist/massalert/info/337534)
- [Naruto broadcaster credit](https://www.tv-tokyo.co.jp/anime/naruto/news/news04/index.html)

## Reproduction

Run `node scripts/verify-title-aliases.mjs` with the project's supported Node
version. It tests these six screenshot inputs and the preceding two reports,
records HTTP statuses and lookup times, and writes
`docs/TITLE_ALIAS_LIVE_RESULTS.json`. It does not capture or upload audio or
use recognition credits. Timings are anime lookup times after recognition,
not total audio identification time.

The regression suite covers all six inputs, one-request resolution, recording
version classification, title collisions, unrelated songs and performers, and
the shared parser's positive and negative cases.
