# Edge v0.4.0 live test evidence

Date: 2026-11-02. Installed extension ID: `oeamoddpghhjhhakjimcelbhjpjfboba`.

The existing unpacked extension was observed enabled at version 0.4.0 and reloaded through Edge's extension manager. The local ShazamIO helper was started and reported healthy. Tests below use real playing YouTube tab audio and the popup's Identify button, not manual song input, injected recognition results, or page-title inference. Screenshots and accessibility output were observed through native Computer Use.

## Orange instrumental: PASS

Source: https://www.youtube.com/watch?v=gG5_1Qgm3Pw&t=90s (seven oops official channel, Orange Instrumental).

- A real 12-second tab capture started. The popup displayed animated capture progress and `Total time: 0:00 · This stage: 0:00` initially.
- Local recognition returned `Orange (Underwater)` by `Kaori Miyazono & Zero Two`. This is an alternate catalog label, not a claim that the recording was audibly underwater.
- Completed popup: `Possible anime connections found. Check the source credits; the recording performer is not confirmed.`
- Total elapsed time displayed: **0:17** (capture + recognition + anime lookup).
- First anime card: **Your lie in April**, artwork visible, `Possible match · Ending 2`.
- Evidence text credits AnisongDB's `Orange` by `7!!`, explicitly leaves the recognized performer unconfirmed, and includes the reviewed release reference naming Shigatsu wa Kimi no Uso.
- Source link: https://anisongdb.com/ . Other same-title possibilities remain labeled possible. No local daily-limit, capture-constraint, or anime-service error occurred.

This verifies the previously failing alternate/instrumental example can display its anime through the new primary provider in the actual installed extension. It does not prove the fingerprinted performer label is correct or measure the anime-only stage separately.

## Aimer instrumental: PASS

Source: https://www.youtube.com/watch?v=dkVLiDWCCtU&t=60s (Aimer official channel, Akane Sasu instrumental).

- Real 12-second tab capture through Identify this tab.
- Recognized song: `Akane Sasu (instrumental)` by `Aimer`, album `Akane Sasu / Everlasting Snow - EP`.
- Completed status: `Song and anime associations found.`
- Anime card: **Natsume's Book of Friends Season 5** (Natsume Yuujinchou Go), artwork visible.
- Evidence: `Version match · Ending 1 · AnisongDB lists a version of “Akane Sasu” by Aimer for Natsume's Book of Friends Season 5.`
- Total elapsed time displayed: **0:15**, including the 12-second capture.
- The previous Orange result was cleared when the new capture started, and replaced by the Aimer result.

## Novelbright: PASS

Source: https://www.youtube.com/watch?v=aLgPe4Scnvs&t=60s (Novelbright official music video, 雪の音).

- Real 12-second tab capture through Identify this tab.
- Mid-capture observation: `Total time: 0:08 · This stage: 0:08`, `8 of 12 seconds`, with the capture bar visibly about two-thirds filled. This verifies timer/bar advancement in the native popup, beyond unit tests.
- Recognized song: `Sound of Snow` by `Novelbright`, album `CIRCUS`.
- Completed status: `Song and anime associations found.`
- Anime card: **A Sign of Affection** (ゆびさきと恋々), artwork visible.
- Evidence: `Confirmed match · Opening 1 · AnisongDB lists “Yuki no Ne” by Novelbright for A Sign of Affection.`
- Total elapsed time displayed: **0:16**, including capture.

## Outcome and scope

All three real installed-Edge capture → local recognition → anime display journeys passed in this session, without manual song input or personal overrides. The popup distinguishes original artist/version evidence from possible different-performer covers. Each result includes an anime image and a source link. The v0.4.0 source build, typecheck, lint, and 140 automated tests passed in the preceding implementation turn; no runtime source changed during these browser tests. See ANISONGDB_LIVE_RESULTS.json for separate measured metadata-only runs.

The observed totals (15–17 seconds) are not provider-only latency or a guarantee for all requests. Recognition labels and catalog coverage can vary. These tests verify Edge only, not Chrome or catalog-wide accuracy.
