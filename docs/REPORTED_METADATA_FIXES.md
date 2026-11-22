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

## Additional seven reports

All seven additional songs were also present in the live catalog. No bundled
anime associations were added.

| Recognized metadata | Root cause and change | Live result |
| --- | --- | --- |
| SOUND OF DESTINY (Live at Campus Fes) [TV Anime Ver.] / Setsuna Ogiso | The TV Anime Ver. suffix prevented stripping either recording label; the character credit differs from Madoka Yonezawa. Added shared suffix support and a song-scoped credit alias, keeping Nana Mizuki's White Album recording separate. | White Album 2, version association |
| 夢路らびりんす / full Japanese cast credit | Catalog title is Yumeji Labyrinth and the group is Labyrinths. Added a title-scoped full-group alias; individual cast members remain distinct. | Urara Meirocho |
| LOVE 2000 / Anna Yanami (CV: Hikaru Tono) | Catalog removes the title space and credits Hikaru Toono. Added verified title and character/actor aliases. | Makeine: Too Many Losing Heroines! |
| STEEL / TRUE | Catalog includes the subtitle -Tekketsu no Kizuna-. Added a verified artist-scoped short-title alias. | Mobile Suit Gundam: Iron-Blooded Orphans |
| After All Tsuduru Omoi '13 / Rena Uehara | Catalog romanizes Tsuduru as Tsuzuru. Added a title alias that retains the meaningful '13 recording year. | White Album 2 |
| 夏を見ていた～「蛍火の杜へ」エンディングテーマ / Sizzle Ohtaka | Unhandled trailing anime-theme metadata, Japanese title, and artist stage name versus Shizuru Ohtaka. Added shared separated-credit removal and song-specific metadata aliases. | Into the Forest of Fireflies' Light |
| Wrong World / TOGENASHI TOGEARI | Catalog stores the Japanese title's romanization Zattou, Bokura no Machi instead of its English title. Added a verified artist-scoped alias. | Girls Band Cry |

Additional primary sources are preserved alongside each alias in
`src/providers/title-aliases.ts`: KING RECORDS and AQUAPLUS for White Album 2,
TBS for Urara Meirocho, Aniplex for Makeine, Lantis for STEEL, the film's official
music page for Hotarubi no Mori e, and the official Girls Band Cry opening video
and release announcement for Wrong World.

`verify-title-aliases.mjs` now checks all fifteen accumulated reports. These are
live metadata resolver tests, not new audio-recognition tests. AnimeThemes HTTP
503 remains an upstream availability issue; these inputs resolve from AnisongDB
without needing that fallback.

## Eleven further reports

Ten reports were metadata mismatches against existing AnisongDB entries. Each
fix uses an artist-scoped title alias or a song-scoped release-credit alias;
no anime title or ID was hardcoded for these inputs.

| Recognized metadata | Root cause | Live result |
| --- | --- | --- |
| はじまりの場所 / Rie Murakawa | Japanese title versus Hajimari no Basho | Forest of Piano Season 2 |
| ベラフの子守歌 / Kevin Penkin | Japanese title and OST composer credit versus Belaf no Komoriuta / Mitsuki Saiga | Made in Abyss: The Golden City of the Scorching Sun |
| Anone / Yuna (CV: Maki Kawase) | Joined-word title and character credit versus Ano ne. / Maki Kawase | Kuma Kuma Kuma Bear |
| Lullaby In the Peaceful Light / Masakatsu Takagi | English release title versus Hidamari no Mori Uta | Wolf Children |
| Comedy / Gen Hoshino | English title versus Kigeki | SPY x FAMILY |
| The secret of happiness / Akane Kumada | English title versus Happy no Hiketsu | I Was Reincarnated as the 7th Prince so I Can Take My Time Perfecting My Magical Ability |
| Rhapsody of Blue Sky / Fhána | English title versus Aozora no Rhapsody | Miss Kobayashi's Dragon Maid |
| 瞳ニ映ル景色 / Kenichirou Suehiro | Japanese title and composer credit versus Hitomi ni Utsuru Keshiki / MAYUKO & Luminous | Girls' Last Tour |
| インキャインパルス (feat. Ikepy & KSKN) / Japanese character trio with guests | Japanese title and compound character credit versus Inkya Impulse / romanized cast and guests | Asobi Asobase |
| Hengen Jizaino Majikaru Star / GRANRODEO | Joined-word boundaries and phonetic English transcription versus Hengenjizai no Magical Star | Kuroko's Basketball 2 |

Composer and vocalist equivalence remains limited to the documented song. The
Ano ne solo recording does not become equivalent to the loved-ones duet. Artist
accent normalization already handles Fhána; no global artist rewrite was added.

Primary sources are linked alongside the aliases: Columbia's Rie Murakawa and
Kuma Kuma Kuma Bear releases, the Made in Abyss official OST page and label
track, Milan's Wolf Children track, Gen Hoshino's release page, Akane Kumada's
official Japanese/English tracks, fhána/Lantis releases, the Girls' Last Tour
soundtrack page and label track, Asobi Asobase's music page, and Lantis's
GRANRODEO video. AnisongDB supplies the actual anime associations.

### Unresolved: Milky Way War History / Nash Music Library

The user suggested Gintama as a possible source. Searches did not establish a
documented connection. The [publisher-distributed release](https://linkco.re/5FU0MdEd/songs/1299944/lyrics?lang=en)
establishes the library track's identity, but does not identify an anime usage.
This may be missing anime-use metadata or an incorrect recognition result; the
screenshots alone cannot distinguish them. A source video or episode number is
needed to investigate further. No speculative Gintama association or permanent
negative override was added. Future valid catalog results can still be used.

The accumulated live check now covers 25 verified inputs, excluding this
unresolved library track. `reported-metadata-third.test.ts` adds ten positive
regressions, a solo/duet guard, and a no-catalog-evidence guard for the library
track. The latter is a mocked negative test, not proof that the song has never
been used in an anime.

## Seven release-credit and nickname reports

| Recognized metadata | Root cause and fix | Expected confidence |
| --- | --- | --- |
| Toki Wo Kizamu Uta (TV Animation Ver.) / VISUAL ARTS / Key | Added shared TV Animation version-label handling, wo/o title equivalence, and a song-scoped publisher credit. The official label release credits Lia and VISUAL ARTS / Key together. | Version association with Clannad: After Story |
| Chika Dance / Gudrap | The catalog uses Chikatto Chika Chika♡ / Konomi Kohara. Added a reviewed nickname for title discovery, without equating Gudrap with the original performer. | Possible connection to Kaguya-sama: Love is War |
| Love Supreme! / Fhána | English release title versus Ai no Supreme! | Confirmed association with Miss Kobayashi's Dragon Maid S |
| Destination of the journey / Hana Hope | English release title versus Tabi no Yukue | Confirmed association with Spice and Wolf: Merchant Meets the Wise Wolf |
| 目覚めの唄 / Yuiko Ohara | Japanese title versus Mezame no Uta | Confirmed association with Mushoku Tensei |
| With love from the closet / Hitori Gotoh | Translated title and character credit versus Oshiire yori Ai o Komete / Yoshino Aoyama | Confirmed association with Bocchi the Rock! |
| 我こそがアインズ・ウール・ゴウン / Syuji Katayama | Japanese title and soundtrack composer credit versus Ware koso ga Ainz Ooal Gown / Ainz Ooal Gown Gasshou-dan | Confirmed association with Overlord |

The optional `titleOnlyAliases` field separates nickname discovery from artist
identity. It is used only for reviewed nicknames such as Chika Dance. Any cover
performer can use that nickname to discover the catalog entry; the existing
credit comparison still determines confidence. Gudrap and a previously unseen
cover performer remain possible matches. Konomi Kohara can receive a confirmed
match for the same nickname. Common translated titles such as Comedy retain
their artist-scoped behavior.

No anime title or ID was added to the production alias records. The live catalog
still supplies anime associations, including multiple seasons or films where
available. The composer, character, and publisher credit aliases apply only to
their documented songs. The shared version parser accepts explicit bracketed or
separated TV Animation Ver./Version labels; ordinary Animation title words are
preserved.

Primary sources are stored with the aliases: the Key Sounds Label release,
official Kaguya-sama goods/music references, fhána's official track, Hana Hope's
official track and Spice and Wolf interview, Mushoku Tensei's music page,
Aniplex's Bocchi soundtrack track, and KADOKAWA's Overlord soundtrack release.
The Gudrap recording itself is not verified as an original anime performance.

The live script now covers 32 inputs, including the required possible-match
classification for the Chika Dance input. The new regression file also verifies
that nicknames cannot grant artist identity, unrelated artist-scoped aliases do
not become globally searchable, and publisher/composer equivalence does not
apply to unrelated songs. Live timing measures anime lookup after recognition.
