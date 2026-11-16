# Music Identifier engine inspection

Date: 2026-11-03 (Asia/Bangkok). Read-only inspection; no third-party extension code was executed, modified, copied into this project's implementation, or used to send a recognition request.

## Inspected artifact

- Edge listing ID: `aillbnknkecmnbmddlkdacbakijheino`.
- Locally installed package version: **1.0.5**.
- Public package assets inspected: manifest.json, scripts/popup.js, scripts/module.js, scripts/module-loader.js; filenames of bundled WASM assets. Browser profile settings, extension storage, listening history, and account data were not inspected.
- Listing: https://microsoftedge.microsoft.com/addons/detail/music-identifier-find-a/aillbnknkecmnbmddlkdacbakijheino
- Publisher website: https://song-identify.com/

## Findings from the installed source

1. Captures current-tab audio using Chromium tabCapture and routes the source through a Web Audio context.
2. Schedules cumulative audio snapshots at **3, 6, 9, and 12 seconds**. The source retains recorded chunks between checkpoints; these are progressively longer snapshots from the same capture, rather than four independent recordings.
3. A worker passes floating-point samples and sample rate to a WebAssembly-backed `extract_signature` function. A signature-ready message returns fingerprint bytes to the caller.
4. Sends the encoded fingerprint in a POST to the **Shazam** website recognition endpoint, `https://www.shazam.com/services/webrec/match_extensionv2`.
5. On a returned match, saves/publishes the result, clears the later checkpoint timers, stops the captured audio track, and closes the audio context. A successful early match does not have to wait for 12 seconds.
6. The inspected version uses ScriptProcessorNode for collection. This demonstrates why a ScriptProcessorNode deprecation warning alone does not establish an identification failure; it is not necessary to retain that deprecated API to implement progressive attempts in this project.

These are static source findings for the installed version. No new live timing benchmark of that extension was run, and the server-side recognition internals are not visible from its client package. The endpoint is an observed website integration, not evidence of a supported public API contract, redistribution license, or guaranteed free service.

## Difference from this project

The current Local Shazam path captures a fixed 12-second PCM sample before sending it to the localhost helper. The helper then fingerprints/queries through ShazamIO, and anime lookup follows song recognition. Consequently there is no possibility of a result before the initial 12-second recording finishes. AudioTag follows its separate 15-second path.

The main improvement suggested by this comparison is **progressive capture and recognition**, not automatically replacing the recognition brand: retain the current capture, try a short snapshot early, keep listening while that request runs, return immediately on a match, and only try longer snapshots when needed. With the existing helper's one-request-at-a-time guard, use one recognition request in flight and coalesce/skip intermediate checkpoints while busy. Do not issue overlapping localhost requests that would receive HTTP 429. Stop capture and further submissions on success/cancel, bound total attempts/time, and keep AudioTag's account/credit behavior separate.

A browser-side fingerprint generator is a distinct future implementation choice. It requires a suitably licensed implementation and protocol/availability evaluation; inspecting another extension is not permission to copy its WASM or code. No runtime behavior was changed during this research.
