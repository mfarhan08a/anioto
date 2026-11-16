# Progressive Local Shazam recognition

Baseline: reduce the fixed initial 12-second wait while keeping existing tab capture, AudioWorklet quality, provider selection, and anime evidence rules.

## Components and decisions

- `capture.ts`: the single existing capture emits independent cumulative snapshots at actual audio-frame checkpoints of 3, 6, 9, and 12 seconds. Frames, not wall-clock timers, determine sample availability. Existing diagnostic and AudioTag callers keep their fixed captures.
- `progressive-shazam.ts`: coordinates capture and recognition. One conversion/helper request can be in flight. While busy, retain only the newest pending snapshot; do not send overlapping helper requests or repeat errors as if they were no-match responses.
- `offscreen.ts`: selects progressive mode only for Local Shazam, publishes listening/checking progress, and passes any returned song(s) through the existing ambiguity/anime resolver.
- `progress.ts` / background lifecycle: recognize the combined active phase and continue elapsed time/cancel controls. Stop recording and pending work on the first non-empty recognition response. Anime lookup starts after song recognition.

Trade-off: this may make up to four recognition attempts instead of one. It does not guarantee that a three-second sample has enough fingerprint information. Busy checkpoints are skipped/coalesced, and provider errors fail visibly without automatic resubmission. Local Shazam has no app-imposed daily cap, but upstream availability/throttling still applies. AudioTag keeps its own 15-second sample/free-credit policy and receives no progressive retries.

Capture frames are retained for at most 12 seconds, with copied pending snapshots and one-hour metadata caching unchanged. Data travels only through the explicitly selected existing helper/provider; no third-party extension implementation or WASM is copied.

## Acceptance checks

1. A match from the first 3-second snapshot stops capture and resolves before 12 seconds in controlled timing tests.
2. No match permits a longer snapshot. A slow first request followed by 6/9/12-second captures results in one latest pending request, not overlapping uploads.
3. Final no-match waits for the final available snapshot, then ends cleanly.
4. Cancellation or provider/capture failure stops capture and queued work; late completions cannot publish stale progress/results.
5. Silent input makes no recognition calls; buffer size and sample-length bounds remain enforced.
6. AudioTag/manual/diagnostic/portable flows retain their existing behavior.

Plan: implement capture seam and coordinator independently → integrate progress and provider branch → build/types/lint/tests → browser audio-engine and native Edge check where tools allow. Record native results separately from synthetic/mocked timing evidence; do not promise observed speed without a live music test.
