# Anioto

A browser extension that identifies music playing in a browser tab and finds documented anime associations for the song.

**Status: v0.10.5 local browser builds.** Edge retains the tested tab-audio flow, Chrome has a separate Chromium build, and Firefox/Safari have limited audio-file/manual lookup workspaces. Safari still needs Xcode packaging and native testing on a Mac. See [browser support and installation](docs/BROWSER_SUPPORT.md), [live Edge evidence](docs/ANISONGDB_EDGE_EVIDENCE.md), and [verification](docs/VERIFICATION.md) for the tested scope and remaining limits.

## On-demand local recognition

On Windows, install the native launcher once with `scripts/install-native-helper.ps1`, then reload Anioto. Opening the popup starts the helper if needed, including after reboot; Windows sign-in and browser startup do not launch it. See [setup, removal and test evidence](docs/ON_DEMAND_HELPER.md).

## Anioto artwork UI

Edge and Chrome show the anime and artwork first, with compact song details, expandable source credits, a persistent Identify/Cancel control and elapsed timer. Search, History and audio diagnostics have separate views. Reload the existing unpacked extension after building to apply changes. See [UI verification](docs/OTONE_UI_VERIFICATION.md).

## Experience

1. Play a video or stream in Microsoft Edge.
2. Select **Identify this tab** in the extension.
3. Capture a short audio sample and identify the song.
4. Display the song, artist, related anime, artwork, and available source links.

The result describes anime associated with the music; it does not identify the visible footage. Song-only and ambiguous results are shown explicitly.

## Stack

- Manifest V3, TypeScript, and esbuild, with separate Chrome/Edge and Firefox/Safari entry points. Portable builds do not request Chromium tabCapture/offscreen permissions.
- Select **SongRec**, **ShazamIO**, or **AudioTag** in Settings. The first two use the project-local helper and query Shazam’s online catalog. AudioTag uses your personal free API allowance.
- AnisongDB for primary song-to-anime lookup, AnimeThemes as a bounded fallback, and AniList for optional artwork/metadata. Recording suffixes (live/acoustic/remaster/piano/cover/instrumental/off-vocal/karaoke/TV-size) resolve to base-song credits. Different-artist title matches are labeled possible, with the catalog artist shown.
- A small reviewed supplemental registry covers sourced featured songs missing from the OP/ED catalog, starting with Netflix’s Cyberpunk: Edgerunners music video. This is not comprehensive background OST coverage. New entries require a source and explicit artist aliases.
- SongRec and ShazamIO check cumulative samples after 3, 6, 9, and 12 seconds while listening continues, and stop on the first match. Only one helper request runs at a time; busy checkpoints are coalesced to the latest sample. Up to four samples may be submitted; provider errors stop without retry. AudioTag and diagnostic preview remain fixed at 15 seconds. Portable audio-file recognition remains a single request. Source-backed anime titles display before optional artwork, with a shared 1.5-second enrichment budget. Successful results are cached in memory for one hour, up to 100 songs, until the offscreen context closes.
- Capture uses 32 kHz mono PCM for analysis and keeps live stereo playback on its direct path. Explicit edit labels (Underwater/Slowed/Sped Up/Nightcore) can find possible base-song anime connections. Recognition services can still choose alternate catalog releases.
- Animated recording/recognition/anime-lookup progress, total and current-stage elapsed timers, and a frozen completion duration. Timers survive closing/reopening the popup.
- Local settings and history. SongRec and ShazamIO use the included local helper.

Recognition and anime lookup require internet access. SongRec and ShazamIO generate fingerprints locally and query Shazam online without an API key. Anime metadata queries go to AnisongDB, AnimeThemes, and AniList.

For the version/cover improvements and timer test evidence, see [0.3.0 verification](docs/VERSION_MATCHING_EVIDENCE.md).

For the instrumental fix and measured lookup timings, see [0.3.1 performance evidence](docs/PERFORMANCE_EVIDENCE.md).

For the Orange alternate-release issue and capture fidelity checks, see [0.3.2 audio evidence](docs/AUDIO_QUALITY_EVIDENCE.md).

## Implementation plan

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for researched choices, architecture, implementation phases, verification, and the eventual installation workflow. This copy inside the repository is the project plan going forward.

See [EXECUTION_LOOP_PLAN.md](EXECUTION_LOOP_PLAN.md) for the proposed delegated build/review loop, model allocation, token-efficiency controls, and prerequisites.

## Development

See [local installation](docs/INSTALL.md). Development uses Node 22.12 or newer. Build with `npm ci` followed by `npm run build`, then load `dist/` as an unpacked extension. Run `npm run typecheck`, `npm run lint`, and `npm test` to check changes. The install guide explains how to use temporary Node 22 when your global version is older.

For local recognition, follow [helper setup](helper/README.md). Run `scripts/setup-songrec.ps1` once on Windows for SongRec, and select **SongRec** or **ShazamIO** in extension Settings. Provider preference is saved locally independently of API-key retention. With native helper setup, Anioto starts the helper when needed.

Never commit API credentials, captured audio, browser profiles, or personal recognition history. When sample configuration is introduced, use placeholders in `.env.example`.

## Contributing

Issues and contributions will be welcome once this repository is published. Describe the intended behavior and relevant verification with each change. Use synthetic or appropriately licensed fixtures; do not commit private or copyrighted audio samples without the necessary rights.

## License

Project code and original documentation are provided under the [MIT License](LICENSE). Third-party services, metadata, artwork, and music retain their own terms and rights. This project is independent and is not affiliated with its planned data providers.
