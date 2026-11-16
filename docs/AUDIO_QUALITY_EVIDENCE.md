# Audio quality and Orange alternate-release matching — 2 November 2026 — v0.3.2

## Findings

The old capture exported mono **8,000 Hz** WAV and played the tab through a mono ScriptProcessor path. The 8 kHz sample cannot retain frequencies above 4 kHz, so it can sound muffled compared with the original music. This was a real fidelity limitation; it does not prove it caused Shazam's particular artist/title choice.

The returned **Orange (Underwater)** by **Kaori Miyazono & Zero Two** is also an existing catalog release, not a diagnostic description invented by the extension. [Spotify's release listing](https://open.spotify.com/track/50kfguKW1syfBC7YslSvfu) names **Orange (from: Shigatsu wa Kimi no Uso)**. The original anime site identifies **7!! (seven oops), Orange** as an ending for [Your Lie in April](https://www.kimiuso.jp/music/04.html). A fingerprint match to an alternate release is not proof that the source video is that release.

## Changes

- Recognition and diagnostic WAV now use **32,000 Hz mono PCM16**. Twelve seconds are at most 768,044 bytes; fifteen seconds at most 960,044 bytes, both below the helper's 1 MB boundary. The resampler uses the actual audio context's source rate.
- Listening playback uses the original stereo source directly. The analysis processor contributes silence to the output, preventing duplicate playback. The extension adds no speech-processing effects to the playback or analysis graph.
- Analysis normally mixes stereo to mono. If the average block almost cancels because the channels oppose each other, it uses the stronger channel instead. This affects the recognition sample, not playback. Capture memory and duration are bounded.
- Explicit trailing edit labels such as Underwater, Slowed/Reverb, Sped Up and Nightcore can resolve to base song credits. Matching a different artist stays **possible**, including collisions with other songs named Orange.
- The exact reported Orange release has a reviewed Spotify reference naming Shigatsu wa Kimi no Uso. This ranks that catalog candidate first and adds a Recording reference link; it does not replace Shazam's performer or invent a confirmed original recording. Documented 7!!/Seven Oops aliases support exact original-artist metadata.

## Automated verification

Build, types, lint and **117 tests** passed. Imported-module coverage is 85.54% statements, 91.74% lines, 76.52% branches and 85.38% functions. Popup behavior is covered with a mocked DOM, not a whole-browser conformance claim. Capture tests verify direct playback routing, silent analysis output, stereo mix/phase fallback, no-effects constraints, capture cleanup, output format and size. They mock Web Audio and do not establish resampling fidelity.

The helper's **14 tests** pass, including acceptance of 32 kHz 12/15-second WAVs and preservation of their rate when cropped to its 12-second analysis window. No helper runtime implementation changed.

## Live metadata

[Raw results](ORANGE_RESOLVER_RESULTS.json) come from `node scripts/verify-orange.mjs`, which supplies title/artist fields and queries the actual catalog. It captures/uploads no audio. The reported alternate release returns a possible Shigatsu wa Kimi no Uso ED connection. Orange (Instrumental) by seven oops returns an artist-matched version connection. The anime association is catalog-backed; the uncertain recognition artist is not silently rewritten.

## Native browser checks

Pending: run the generated synthetic browser harness against real OfflineAudioContext, then test the supplied public Orange instrumental in the installed Edge extension. No subjective listening or recognition-accuracy improvement is claimed yet.

Reproduce the synthetic check with `node scripts/build-audio-check.mjs`, then open the generated ignored `local-data/audio-signal-check.html` in Edge. It generates only test tones, exercises the production resampler and measures WAV PCM amplitudes. It neither requests audio permissions nor sends network requests.

Version0.3.3 live follow-up caught and fixed Chromium rejecting mixed constraint formats. The source selector now uses only the valid legacy tab mandatory constraints. Direct stereo playback, the32kHz output, and phase-aware mono analysis remain. The actual Edge capture now starts successfully. See LOCAL_LIMIT_FIX.md for this runtime correction.

The v0.3.3 full live Orange instrumental run returned **Orange — seven oops**, rather than the reported Underwater/Kaori alternate-release credit. This is one recognition result, not a catalog-wide accuracy guarantee. The metadata request timed out, so no new anime lookup success is claimed for this particular run.
