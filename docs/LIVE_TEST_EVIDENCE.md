# Live Edge verification — 1 November 2026

## Successful end-to-end recognition

Test source: https://www.youtube.com/watch?v=aLgPe4Scnvs&t=60s — Novelbright's official 雪の音 music video.

Environment: the user's installed unpacked extension in Microsoft Edge, extension ID `oeamoddpghhjhhakjimcelbhjpjfboba`. Browser actions were performed through native browser-control tools, using the actual playing tab. This was not a mocked provider response, a manually entered title, or a page-title extraction.

Provider selected explicitly in Settings: **Local Shazam helper (experimental, no API key)**. The repo-local helper was running at `127.0.0.1:18742`, with the installed extension origin allowed. No AudioTag key was sent to the helper. No paid API subscription was enabled.

Observed journey:

1. Reloaded the actual extension and confirmed the visible build version.
2. Loaded the source video at a music section and verified the player was advancing.
3. Opened the toolbar extension and clicked **Identify this tab**.
4. Observed **Listening to the selected tab for 15 seconds. Playback continues through your speakers.**
5. Observed the final status **Song and anime associations found.**
6. Read the rendered result from the native accessibility tree and captured its visible screenshot in the chat's tool output:

| Field | Actual result |
|---|---|
| Song | Sound of Snow |
| Artist | Novelbright |
| Album | CIRCUS |
| Anime | A Sign of Affection (ゆびさきと恋々 / Yubisaki to Renren) |
| Connection | OP |
| Source link | https://animethemes.moe/anime/yubisaki_to_renren |
| Artwork | Anime cover rendered in the result card |

The title alias registry bridges the recognized English title to AnimeThemes' `Yuki no Oto` catalog title for this artist. It does not provide an audio recognition answer: the local recognizer returned the song first, then the resolver required the database's matching song/artist/theme relationship.

## Other observations

- Local-only capture test completed and produced a playable approximately 15-second WAV preview, without a recognition upload. It is temporary memory, not an audio file saved by this project.
- AudioTag explicitly returned no match for this test track's sampled section. Its no-match result is preserved as a provider limitation in this test, not called a successful recognition.
- A manual title lookup was also tested separately. That journey is not evidence of audio recognition. Network/provider failures are now distinguished from an explicit empty association result.
- The narrow popup was corrected to a readable desktop width. The screenshot of success shows both result cards and the source link.

## Limits

This verifies the supplied track on the tested Edge installation. It does not establish a catalog-wide accuracy rate, all background OST coverage, or Chrome compatibility. ShazamIO uses an unofficial Shazam integration; upstream changes may affect availability. The local helper must be running, and its allowed origin must match the installed extension ID.
