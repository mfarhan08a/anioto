# Progressive recognition · v0.6.0

Local Shazam tab capture now submits cumulative audio at 3/6/9/12 seconds while the same recorder continues listening. A match aborts capture immediately and starts the existing anime resolver. Only one conversion/helper request runs at once; intermediate pending checkpoints are replaced by the newest. Provider errors fail visibly, rather than retrying them as no-match. Cancellation discards queued work and late responses. Overall recognition is bounded at 65 seconds. This changes neither browser permissions nor dependencies.

AudioTag still submits one 15-second sample. Diagnostic previews and portable file/manual lookup retain their behavior. The popup shows an animated, indeterminate combined listening/recognition stage, attempt length, and elapsed timer; it does not claim a fabricated completion percentage.

## Verification on 2026-11-03

- All four browser targets build; TypeScript and ESLint pass.
- **198 tests in 18 files pass**. The controlled fake-clock test returns at 3.5 seconds (a 3-second sample plus a simulated 500ms response) and verifies that capture stops while the caller's anime-lookup signal remains live. This is scheduling evidence, not a live Shazam speed measurement.
- Regression cases cover frame-based exact cumulative prefixes, silence, coalescing 6/9/12 while a slow 3-second request runs, no overlapping conversions/uploads, final no-match, provider errors, cancellation, 65-second timeout, and ignoring late results. Background recovery, duplicate-start prevention, progressive cancellation, built popup controls and elapsed time are exercised.
- **18 helper tests pass** with localhost access. An initial sandboxed run could not access test sockets; the same tests passed with the needed localhost permission.
- The actual Chrome offline audio engine passed the packaged AudioWorklet and production mixing/WAV conversion check: 48,000 frames, 12 batches, 64,044-byte 32kHz PCM WAV, untouched analysis input peak approximately 0.2 and silent processor playback output. This uses synthetic input, without tab capture or song identification. Raw output: [WORKLET_BROWSER_RESULTS.json](WORKLET_BROWSER_RESULTS.json).
- Coverage of imported modules: 86.28% statements, 92.70% lines, 77.04% branches, 86.30% functions.

## Native Edge live result

The already-installed unpacked extension was reloaded and the extension manager visibly reported **0.6.0**, enabled, at its existing ID/path. The existing local helper was healthy with that extension origin allowed. No API key was read or changed.

Test video: [Novelbright — 雪の音](https://www.youtube.com/watch?v=aLgPe4Scnvs&t=60s), starting around the clear music section at 1:00. Playback was visibly advancing. The extension's Identify button was clicked on that tab; the recognition path receives captured audio, not the page title.

Observed popup/accessibility evidence:

```text
Listening and recognizing. Checking the 3-second sample while listening continues.
Stops automatically when a song matches.
Total time: 0:03 · This stage: 0:03

Song and anime associations found.
Total time: 0:08
Sound of Snow
Novelbright
CIRCUS
A Sign of Affection
Confirmed match · Opening 1 · AnisongDB lists “Yuki no Ne” by Novelbright for A Sign of Affection.
```

The completed result was also visually inspected in the popup with artwork. Identify became available again, Cancel was disabled, and the browser's “Tab content shared” indication disappeared while video playback continued. The result remained visible for review. This verifies the native Edge audio-to-song-to-anime path for this sample and an 8-second observed total, including anime lookup. No guaranteed speed or broad accuracy claim follows from one run. The exact successful checkpoint was not separately instrumented; the observed first check was the 3-second sample.

Real recognition time depends on the music section, fingerprint coverage, and helper/upstream response time. A short sample can fail even when a longer sample succeeds. Up to four samples may be sent to the existing Local Shazam helper/upstream; no third-party extension code or fingerprint WASM was copied. Chrome's extension capture path and Firefox/Safari native functionality were not retested for this change.
