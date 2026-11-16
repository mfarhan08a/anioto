# Requested Mirai soundtrack test — v0.4.0

Date: 2026-11-02. Video: https://www.youtube.com/watch?v=EBADJnyHYX0 (Mirai End Credits).

The installed Edge extension was tested through its Identify this tab button while the video was visibly playing. The existing local ShazamIO helper was healthy. No manual song input, page-title inference, personal override, or recognition mock was used.

## Observed result

- A real 12-second tab capture completed.
- Recognition: **Music Train (Karaoke)** — **Tatsuro Yamashita**.
- Album: **Theme of Mirai / Music Train - EP**.
- Popup: `Song identified; no documented anime connection found after checking song credits and alternate versions.`
- Anime area: `No confirmed anime connection found.`
- Total time displayed: **0:16**.

Outcome: audio recognition succeeded; anime association failed on this input. This is not a successful end-to-end anime match.

## Catalog diagnosis

Live AnisongDB exact-title search for `Music Train` returned HTTP 200 with zero entries. An exact artist search for `Tatsuro Yamashita` returned seven song credits, including **Uta no Kisha → Mirai**, AniList ID 100749 / MAL ID 36936. See MIRAI_CATALOG_CHECK.json for request inputs, timings, and results.

The existing recording-suffix code handles `(Karaoke)`; the missing step is a verified artist-specific translated-title alias connecting `Music Train` with `Uta no Kisha`. The resolver correctly does not select arbitrary songs by the same artist. No runtime code was changed for this test.

Primary supporting references: the film's production notes credit `MUSIC TRAIN` to Tatsuro Yamashita (https://fetch.fm/media/uploads/production-notes/2018/09/06/12/27/MIRAI_Production_Notes.pdf), and the official film-product listing names `Uta no Kisha` as the ending theme (https://www.asmart.jp/en/shop/hoshino_gen/product/10018969).

The fingerprint's Karaoke label is recorded as returned by recognition; this test does not establish that the video contains a karaoke recording or a cover/remix.
