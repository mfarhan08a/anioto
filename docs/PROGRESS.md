# Execution progress

1 November 2026 — first delegated implementation loop in progress.

- Coordinator owns UI, integration, personal-data handling, and final verification.
- Luna foundation worker owns manifest/build/capture/job lifecycle.
- Luna providers worker owns AudioTag free-allowance guard and anime associations.
- AudioTag API protocol documented: account statistics expose remaining free recognition seconds; upload and result retrieval are separate operations. Account renewal/entitlement remains unverified.
- No API credential has been supplied or stored. No audio has been uploaded. No paid plan or GitHub publication has been activated.
- Build, typecheck, and lint pass. All 17 current tests pass after correcting Chrome API mocks. Whole-project statement coverage is 49.26%; capture/offscreen/UI coverage remains incomplete, with further targeted tests underway.
- A live AnimeThemes query verified the song search shape and an unravel -> Tokyo Ghoul OP association; metadata response handling was corrected from this evidence.
- User confirmed free AudioTag access and installed the extension with a privately entered credential. The project has not read or logged that key.
- Automated browser control stopped because its policy layer could not determine Edge's URL confidently. No automated live recognition was attempted. A manual browser-result check is pending.
- Dependency audit pending. No full-readiness claim yet.

Follow-up verification:

- Added 10 capture/offscreen tests. Their targeted run passed and exposed cleanup defects that were fixed (early cancellation and setup failure cleanup).
- Found advisory issues in older development tooling. Updating the test runner/build dependencies under temporary Node 22; no global runtime modification.
- The implementation uses esbuild directly instead of the proposed Vite UI build; this keeps the extension bundle setup small. Node 22.12+ is the development target after the tooling update.
- Automated Edge control remains unavailable after the URL-confidence policy stop. User has been asked to reload the build and report a manual identification result. This is a verification dependency, not a cancellation of the project.

Latest checkpoint:

- Toolchain upgraded and checked with temporary Node 22.23.4; build/typecheck/lint and all 30 tests pass.
- Audit: zero high/critical, ten moderate advisories in the lint tooling; no safe automatic fix reported.
- First manual test exposed invisible popup status. Fixed classic-script Window.status collision with isolated IIFE bundles and renamed DOM references; generated-bundle regression passes.
- Corrected `dist/` rebuilt. User has been asked to reload and report the next identification result. See VERIFICATION.md for precise evidence and limitations.

Next manual result: user reports “No song was recognized in this sample.” The capture/recognition path reaches a terminal response, but the previous adapter could also flatten unreadable matched-track details into an empty result. Separating explicit provider no-match from malformed match data; song/video context requested before assuming a catalog limitation or changing providers.

Latest diagnostic build: all 40 tests, build, typecheck and lint pass. Explicit AudioTag no-match and malformed found-data now have different outcomes. User's test is Novelbright 雪の音, expected Yubisaki to Renren. Verified the actual AnimeThemes title “Yuki no Oto” and added a source-backed artist-specific alias. Added a local-only tab-audio preview (temporary memory, no recognition upload) and asked the user to report whether the actual captured song is audible. Successful audio recognition is still pending; this is not declared complete.

Provider facts come from https://audiotag.info/faq and https://user.audiotag.info/doc/AudioTag-API.pdf. Consult current account limits rather than assuming unlimited free use.


## 2 November 2026 — version/cover lookup and progress (0.3.0)

Implemented bounded base-song lookup, explicit possible cover candidates, reviewed featured-song supplements, animated stages, and persisted request/stage elapsed timers. Build/types/lint and 76 tests pass. Live metadata cases and limitations are recorded in VERSION_MATCHING_EVIDENCE.md and LIVE_RESOLVER_RESULTS.json. Native UI verification is tracked separately there.


## 2 November 2026 — v0.3.1 instrumental lookup and performance

Fixed instrumental/off-vocal/karaoke/TV-size variants and Aimer Japanese title aliases. Measured the supplied Akane Sasu instrumental resolving to Natsume Yuujinchou Go. Metadata timing changed from 21.210 s to first title at 5.467 s / complete at 6.985 s in a one-sample comparison; warm cache <1 ms. Local capture now12s, artwork is optional with1.5s deadline, cache bounded100/1h. Build/types/lint and100tests pass. See PERFORMANCE_EVIDENCE.md for scope and browser check status.

Native Edge final check: correct Aimer instrumental → Natsume Yuujinchou Go ED result. Cold retry25s; agent-operated repeat with new12s capture and cachedmetadata14s. Source-backed screenshot and elapsedtimer confirmed. First coldmetadata timeout remains documented.


## 2 November 2026 — v0.3.3 local daily caps

Removed the extension20/day and helper30/day caps for Local Shazam. AudioTag local cap and free-quota checks remain. Build/types/lint/118extensiontests and15helpertests pass. Restarted verifiedprojecthelper andcheckedhealth. Legacycounter20 no longerblocksLocal Shazam.
