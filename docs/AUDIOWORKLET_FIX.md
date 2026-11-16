# Recorder warning and stalled-capture fixes — v0.5.2

Date: 2026-11-03 (Asia/Bangkok).

## What the screenshot establishes

The screenshot contains the browser warning `The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead.` This is a deprecated-API warning; it does not itself establish why an identification returned no result. The user described seeing elapsed time and stage labels, without a specific failure message.

## Changes

- Replaced ScriptProcessorNode with the packaged `audio-capture-worklet.js` processor in Edge/Chrome. No deprecated fallback is used. Worklet registration and its asset are checked in built outputs.
- Preserved the direct stereo playback path and existing mono analysis, opposite-phase protection, 32 kHz PCM WAV, 12/15-second capture choices, and upload size bounds.
- Audio-thread batches are bounded and copied; output stays silent to avoid duplicate playback. Completion flushes the final partial batch. A missing flush acknowledgement fails within 500 ms rather than discarding data silently.
- Added cancellation and eight-second timeouts for tab stream-ID acquisition, getUserMedia, worklet loading, and AudioContext startup. Late-arriving media streams are stopped after cancellation/timeout; processor failures clean up the graph, port, tracks, and context.
- An empty stream ID fails before recording starts. These changes close setup paths that previously could leave an active elapsed timer indefinitely; they do not prove which path affected this user's session.

## Verification

- All four browser builds generated at v0.5.2; TypeScript, source ESLint, and worklet JavaScript syntax check passed.
- **180 tests / 17 files passed**, including actual worklet-source VM tests and capture/lifecycle regressions. Imported-module coverage: 86.28% statements, 92.59% lines, 77.19% branches, 85.27% functions.
- A separate headless Chrome test profile ran the actual worklet in the browser's offline audio engine and the production mixing/resampler. Result: **PASS**, 48,000 input frames in 12 batches, expected mono peak 0.200000003, silent processor output, 64,044-byte one-second mono WAV at 32,000 Hz. See WORKLET_BROWSER_RESULTS.json. This is synthetic audio processing, not tab capture or positive song recognition.
- The existing helper reported healthy for the installed Edge origin. A first synthetic connectivity probe received HTTP 429 (another recognition running). A later probe returned **HTTP 200 with an empty song list in 2.88 seconds**, as expected for a generated sine tone. The busy state cleared. See HELPER_CONNECTION_CHECK.json. This does not validate recognition of a real music track.
- No dependency or browser-permission changes were introduced. Existing browser/privacy/capture limitations remain.

## Apply

Reload the existing unpacked extension at `edge://extensions`, then reopen it on a playing media tab and start a new identification. Stored warnings may remain listed until cleared, even after the deprecated code is removed. A newly started v0.5.2 capture should not create a ScriptProcessorNode warning. If setup stalls it now reports a timed-out step; that exact popup message is useful for diagnosing any remaining failure.

The original no-results report is not considered fully reproduced/resolved by the screenshot or synthetic checks alone. A new native Edge song-identification test is still needed.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode documents the deprecation and AudioWorklet replacement.
