# Current v0.8.0 verification

On-demand helper startup implemented and native launcher registered for this device. Opening Otone (Local Shazam) checks/starts the helper; no Windows/browser startup launch. All builds, types, lint, **249 extension tests**, **25 helper tests** pass. Real native framed-message cold start and same-PID reuse passed. See [setup and evidence](ON_DEMAND_HELPER.md). Installed Edge was reloaded to v0.8.0. With the verified helper stopped, opening the actual popup restarted it successfully and the health check passed. An actual device reboot was not performed.

# Earlier v0.7.3 verification

Verified Mikansei Stride Japanese-title and Kodama/Codama artist spellings now resolve the screenshot input to Hyouka, Opening 2, confirmed. All builds, types, lint and **243 tests** pass. Three live production-resolver metadata cases pass with one catalog query each. See [Hyouka evidence](HYOUKA_FIX.md). No new browser audio run is claimed.

# Earlier v0.7.2 verification

THE FIRST TAKE recording suffixes now resolve the reported Akuma no Ko input to Attack on Titan Final Season Part 2, Ending 1 as a version match. All builds, types, lint and **239 tests** pass. Three live production-resolver metadata cases pass; exact screenshot input published its anime in 429ms and completed with artwork in 1838ms. See [First Take evidence](FIRST_TAKE_FIX.md). No new browser audio run is claimed.

# Earlier v0.7.1 verification

Fixed native extension popup collapse by replacing dynamic viewport sizing with an explicit document/body height. All packages build and nine built-popup tests pass. Full-height installed Edge popup was visually observed with artwork, song, timer and controls. See [native sizing fix](OTONE_HEIGHT_FIX.md). No new audio recognition test was performed.

# Earlier v0.7.0 verification

Otone artwork-first popup implemented. All four builds, types, lint and **231 tests** pass; zero high/critical audit advisories. Actual built-popup browser fixture checks pass for real artwork, first-screen result visibility, navigation, elapsed timer, keyboard cancellation, and zero reported axe violations in tested states. See [Otone UI evidence](OTONE_UI_VERIFICATION.md). Native extension reload is pending; no new live audio run is claimed.

# Earlier v0.6.5 verification

TV Edit suffixes and a dash before trailing guest credits now resolve the exact reported Red Swan title to Attack on Titan Season 3, Opening 1 as a version match. All packages build; types, lint and **229 tests** pass. Three live production-resolver metadata cases pass, each with one exact song query. See [Red Swan TV Edit evidence](RED_SWAN_EDIT_FIX.md). Reload is required; no new tab-audio test was performed.

# Earlier v0.6.4 verification

Unbracketed TV-size version suffixes and verified Kamikazari title spellings now resolve the reported song to Ascendance of a Bookworm, Ending 1. All packages build; typecheck, lint and **221 tests** pass. Three live production-resolver metadata cases pass; exact screenshot input completes in 1248ms including artwork. See [Bookworm evidence](BOOKWORM_FIX.md). Reload is required; no new tab-audio test was performed.

# Earlier v0.6.3 verification

Sakurasou Japanese TV-size suffix, title spelling and mixed-language complete trio credit fixed. All packages build; typecheck, lint and **213 tests** pass. Three live production-resolver metadata cases pass. Exact screenshot input publishes The Pet Girl of Sakurasou, Opening 1 as a version match in 454ms, completing with artwork in 1902ms. See [Sakurasou evidence](SAKURASOU_FIX.md). Reload is required; no new tab-audio test was performed.

# Earlier v0.6.2 verification

Onegai Japanese title and exact character/voice credit now resolve to No Game, No Life, Opening 2. Build, types, lint and **206 tests** pass; three actual production-resolver live metadata cases pass with one song request each. Exact screenshot input returned in 1222ms including artwork. See [Onegai verification](ONEGAI_FIX.md) and [raw results](ONEGAI_LIVE_RESULTS.json). Reload the installed extension to apply; no new audio capture test was performed.

# Earlier v0.6.1 verification

Japanese/romanized Literature title and Reina Ueda artist equivalence fixed. All browser packages build; typecheck, lint and **202 tests** pass. Three actual production-resolver cases against live catalogs return Wandering Witch: The Journey of Elaina, using one song-catalog request each. See [Japanese title evidence](JAPANESE_TITLE_FIX.md). Native reload verification is pending.

# Earlier v0.6.0 verification

Progressive Local Shazam tab recognition, animated progress and cancellation pass build, types, lint, **198 extension tests**, **18 helper tests**, and the real Chrome synthetic audio-engine check. The installed Edge v0.6.0 identified Novelbright’s Sound of Snow and its confirmed anime A Sign of Affection in an observed **8 seconds total**, with the 3-second check visible while recording continued. This is one live sample, not a speed guarantee. See [progressive recognition evidence](PROGRESSIVE_RECOGNITION_EVIDENCE.md) for timing scope and limitations.

# Verification — 3 November 2026 — v0.5.2

AudioWorklet recorder migration, bounded setup/flush, and stream-ID timeout changes pass build, typecheck, source lint, and **180 tests in 17 files**. A real Chrome offline audio-engine test passed with the packaged worklet and production WAV resampler. The local helper also responded normally to a synthetic connectivity check after a transient busy response. These checks do not establish a positive native Edge song result for the user's current no-results report. See [recorder fix evidence](AUDIOWORKLET_FIX.md), [native worklet output](WORKLET_BROWSER_RESULTS.json), and [helper connectivity](HELPER_CONNECTION_CHECK.json).

## Earlier v0.5.1 verification

Featured-title credits and the Music Train translated-title alias are fixed. Build, typecheck, lint, and **173 tests in 16 files** passed. Both reported title/artist pairs resolved through the real production resolver against live catalogs, alongside six earlier examples. See [title-credit fix evidence](TITLE_CREDIT_FIX.md) and [raw results](TITLE_CREDIT_LIVE_RESULTS.json). These are metadata-only checks; no new native browser audio test was performed for this patch. Browser permissions and dependencies are unchanged.

## Earlier v0.5.0 verification

Cross-browser builds, typecheck, lint, and **158 extension tests / 18 helper tests** passed. Firefox `web-ext` validation has zero errors and one distribution-consent warning; an isolated Firefox temporary add-on load succeeded. Native Firefox UI testing was blocked by Computer Use app approval timing out. Chrome native capture remains pending; Safari needs a Mac/Xcode package and native testing. See [cross-browser verification](CROSS_BROWSER_VERIFICATION.md) and [browser installation/support](BROWSER_SUPPORT.md) for the exact tested scope and limitations.

## Earlier v0.4.0 verification

Build, typecheck, lint, and all **140 tests in 12 files** passed for the AnisongDB-primary build. Coverage: 86.32% statements, 92.49% lines, 77.06% branches, 87.8% functions. The dependency audit reported no high/critical advisories and ten existing moderate development-tool advisories. No dependency upgrades were introduced in this change.

The installed Edge extension was observed enabled at v0.4.0 and reloaded. Real audio capture/recognition/anime journeys passed for Orange instrumental (17s, Your Lie in April as a possible cover connection), Akane Sasu instrumental (15s, Natsume Yuujinchou Go version match), and Novelbright Sound of Snow (16s, A Sign of Affection confirmed match). The dynamic capture bar and elapsed timer were observed at 8/12 seconds. See [native Edge evidence](ANISONGDB_EDGE_EVIDENCE.md) and [live production-resolver measurements](ANISONGDB_LIVE_RESULTS.json).

These checks verify the installed Edge flow for those samples. Chrome, comprehensive OST coverage, catalog-wide recognition accuracy, and full accessibility conformance remain unverified.

## Earlier v0.3.3 verification

Build, types, lint and 118 tests pass. Imported-module coverage is 85.54% statements, 91.74% lines, 76.52% branches and 85.38% functions. Helper tests: 15/15 pass, including the new 32 kHz sample contract. Tests with mocked Web Audio do not prove audible fidelity; the native synthetic check is tracked separately.

See [audio quality/Orange evidence](AUDIO_QUALITY_EVIDENCE.md), [live Orange metadata output](ORANGE_RESOLVER_RESULTS.json) and earlier [performance evidence](PERFORMANCE_EVIDENCE.md). Chrome, comprehensive OST coverage, catalog-wide recognition accuracy and full accessibility conformance remain unverified. Dependencies are unchanged from the audit reporting no high/critical advisories and ten moderate development-tool advisories.

The Local Shazam daily caps were removed in v0.3.3. The old-counter and 35-request regressions pass; the local helper has been restarted and verified healthy. See LOCAL_LIMIT_FIX.md.

Installed Edge v0.3.3: Local Shazam selected and saved, helper restarted/healthy, newcapture started and recognized Orange byseven oops. No localdailycap/captureconstraint error. AnimeThemes timedout separately; see LOCAL_LIMIT_FIX.md.
