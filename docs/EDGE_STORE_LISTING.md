# Edge store listing

Prepared November 18, 2026 for the English (United States) draft of Anioto - Anime Song Finder.

## Media

| Asset | File | Dimensions |
| --- | --- | --- |
| Extension logo | `public/anioto-icon.png` | 128 × 128, Edge’s accepted minimum |
| Result example | [anioto-result.png](store-assets/anioto-result.png) | 1280 × 800 |
| Manual search | [anioto-search.png](store-assets/anioto-search.png) | 1280 × 800 |
| Progress example | [anioto-loading.png](store-assets/anioto-loading.png) | 1280 × 800 |

The screenshots render the actual built popup inside a presentation frame. The result uses labeled example song data and the progress screen is labeled as simulated. The example uses the popup’s artwork placeholder. Regenerate them after building with Node 22.12 or newer by running `node scripts/render-store-screenshots.mjs` on Windows with Edge installed. `ANIOTO_SCREENSHOT_BROWSER` can specify another compatible Chromium executable.

## Search terms

`anime song`, `anime soundtrack`, `music recognition`, `song finder`, `anime opening`, `anime ending`, `SongRec`.

## Description

Anioto identifies songs playing in your browser tab and finds their documented anime connections. See the song, artist, anime artwork, and source credits together.

### Get started

1. Install the Anioto Windows companion to use SongRec or Local Shazam.
2. Play a clear music section in a video or stream.
3. Open Anioto and select Detect anime from this tab.

### Features

- Discover anime opening, ending, insert-song, and documented alternate-version connections.
- View English and romaji anime titles and copy either title when available.
- Search manually using a song title and artist.
- Follow the scan with animated progress and an elapsed-time display, or cancel it.
- Revisit up to 100 recent results stored on your device.
- Check tab-audio capture with a local preview.

### Windows companion

SongRec is the default provider. SongRec and Local Shazam require a separate, one-time Windows x64 companion installation. After setup, opening Anioto starts the helper when a local provider is selected. Both create fingerprints on your device and query Shazam through unofficial integrations.

### Provider choices and privacy

Choose SongRec, Local Shazam, or the optional AudD cloud service in Settings. Each scan uses the selected provider. AudD availability depends on the configured service and requires permission to upload a short audio sample. Anime databases receive song and artist queries to look up credits.

Results depend on the recognition catalog and available anime credits. Possible cover connections are labeled, and some recognized songs may have no documented anime connection.

Anioto is open source under the MIT license. Setup instructions, source code, and support are available at [mfarhan08a/anioto](https://github.com/mfarhan08a/anioto). Read the [privacy policy](https://github.com/mfarhan08a/anioto/blob/main/PRIVACY.md).

## Before certification

The current package is a release-preparation build. Replace placeholder production URLs, configure the companion for the official Edge extension ID, and complete the remaining work in [store verification](STORE_VERIFICATION.md) before submitting for certification.
