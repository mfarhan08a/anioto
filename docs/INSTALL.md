# Local installation

For the Chrome, Firefox, and Safari build folders and their different feature sets, see [browser support](BROWSER_SUPPORT.md). Safari requires packaging on a Mac; Firefox/Safari currently use audio-file or manual lookup rather than live tab audio capture.

## Build

Use Node 22.12 or newer (see package.json) and npm. From the repository folder:

```powershell
npm ci
npm run build
npm run typecheck
npm run lint
npm test
```

Building is only needed for development; the generated `dist/` can be loaded directly. If dependencies are already installed but your global Node is older, a temporary registry-provided Node 22 can execute the entry points directly: `npm exec --yes --package=node@22 -- node scripts/build.mjs` or `npm exec --yes --package=node@22 -- node node_modules/vitest/vitest.mjs run`. This downloads Node/tooling without changing global Node. On Windows, nesting `npm run` behind this prefix can still select the system Node through npm.cmd, so use the explicit `node` entry point. For a fresh development installation, using supported Node 22.12+ with the normal commands above is recommended.

The build creates `dist/`. It contains the manifest and browser bundles. Never add your personal key to this directory or source files.

## Edge

1. Open `edge://extensions` in Edge.
2. Enable Developer mode and choose **Load unpacked**.
3. Select this project's `dist` directory, not the repository root.
4. Pin Anime Song Finder in the extensions menu.
5. Open Settings and choose a recognition provider. For the tested local ShazamIO path, follow [helper setup](../helper/README.md), start it, and choose **Local Shazam helper**; no API key is needed. Settings shows a launch command with your actual installed extension ID.
6. If you choose AudioTag instead, enter your personal API key and confirm the audio disclosure after checking the account's free allowance. Remembering the key is optional; otherwise it lasts for the browser session. Provider preference itself is saved locally.
7. Play a video, open the extension, and select **Identify this tab**.

Chrome uses the same steps at `chrome://extensions`. Browser compatibility must be verified on the installed versions; an installation guide is not proof that the live browser tests passed.

## Free access

Before uploading audio, the adapter asks AudioTag for remaining free seconds and refuses recognition if the amount is unknown or below the sample duration. An account may still require registration and may have nonrenewing or otherwise limited free access. No paid provider fallback is enabled. Do not assume that a local preflight check is an atomic provider-side spending cap: concurrent use of the same account elsewhere can change the balance.

The local provider uses the included helper and unofficial ShazamIO integration rather than a paid API subscription. It has no app-imposed daily attempt limit and must be started again after reboot. It is explicitly selected, never an undisclosed fallback. Both providers depend on upstream availability and catalog coverage.

## Manual lookup

You can search by known song title and artist without an AudioTag credential. Exact artist/title matching favors avoiding incorrect associations. Covers, alternate spellings, translated titles, and missing database entries may return no anime.

## Check captured audio without using recognition credits

Open **Check captured audio locally** in the popup and select **Test tab audio locally** while the source tab plays music. This records a 15-second local preview and makes no recognition request. Play the preview to check that it contains the expected song. The preview stays in memory for at most two minutes, or until the next capture/lookup replaces it. It is not written to disk or exported. If it expires, run another local test. Cancel stops an in-progress capture.

## Troubleshooting

- Missing key/free access: open Settings and review the AudioTag account.
- No free seconds: the extension will not start recognition. It does not purchase credits.
- No audio: make sure the selected tab is playing audible media. Protected or browser-internal pages may not support capture.
- Song-only result: the song was recognized, but a documented anime association was not found or a metadata service was unavailable.
- Network/provider errors: retry manually after checking connectivity; uploads are never automatically resubmitted.
- After source updates: rebuild and select **Reload** on the extension card.

## Personal data

History is stored locally, limited to 100 results, and can be cleared from the popup. Personal matches can be imported/exported in Settings; import replaces previous personal matches. Exports omit API credentials. Locally remembered keys use browser extension storage, not a credential vault. Normal recognition audio is held in memory only during processing. An explicitly requested local diagnostic preview lasts up to two minutes and is not uploaded; AudioTag's retention of normal recognition submissions follows its own policy.


Version 0.4.0 records 12 seconds for Local Shazam, and 15 seconds for AudioTag or the local-only diagnostic preview. Anime lookup uses AnisongDB first, with a bounded AnimeThemes fallback. The anime title appears before optional artwork; a one-hour in-memory metadata cache speeds repeat lookups. Reload the existing unpacked extension after rebuilding. This version adds host access to `https://anisongdb.com/*` for metadata requests; audio still goes only to the selected recognition provider. The existing capture/storage permissions are unchanged.
