# Cross-browser verification — v0.5.0

Date: 2026-11-02. This report distinguishes built/tested code from actual native-browser evidence.

## Automated checks

- All four build targets generated successfully: `dist`, `dist-chrome`, `dist-firefox`, `dist-safari`.
- TypeScript check and source ESLint passed.
- **158 tests across 15 test files passed**, including the existing capture/resolver/UI regressions, audio-file decoding/cropping/rejection tests, generated manifest/entry validation, and built portable-workspace tests using browser-only and chrome-only namespaces.
- Imported-module coverage: **86.64% statements, 92.83% lines, 77.60% branches, 87.50% functions**. Generated UI bundle tests do not add TypeScript UI coverage to these figures and are not native-browser tests.
- **18 helper tests passed**, including real HTTP requests from configured Edge/Firefox/Safari origins, uppercase Safari UUID origin handling, CORS echoing the exact configured origin, and rejection of website origins and fake origin paths. No arbitrary website or wildcard access was added.
- Dependency audit: no high/critical findings; ten existing moderate development-tool advisories. Project dependencies are unchanged; Mozilla's validation tool was run from an npm cache, not added to the project.

## Firefox validation and actual load

Mozilla `web-ext` **10.8.0** lint reported **0 errors, 0 notices, 1 warning**. Raw output is in `FIREFOX_LINT_RESULTS.json`. The warning is `MISSING_DATA_COLLECTION_PERMISSIONS`: a data-transmission declaration is required before new AMO distribution. This local-development build does not claim AMO readiness, and does not falsely declare that no data is transmitted. The workspace requires explicit audio-submission consent and keeps AudioTag keys in page memory only.

The generated Firefox build was accepted and loaded by `web-ext run` as a **temporary add-on** in a newly created test profile, without selecting or changing the user's normal Firefox profile. CLI output confirmed installation of `dist-firefox` and disabled automatic extension reloading.

A native Firefox window was returned by Computer Use. Its visual inspection did not complete: **Computer Use app approval timed out**. Therefore manual lookup with live providers and audio-file recognition in actual Firefox remain **unverified**. The owned `web-ext` test session was stopped afterward. The successful temporary load is evidence of package acceptance, not functional end-to-end success.

## Chrome / Edge / Safari

- **Chrome:** separate full Chromium capture build produced and tested for correct manifest/entries; native Chrome tab capture/recognition not executed in this turn. Its extension ID must be configured independently in the helper. Do not substitute prior Edge evidence for a Chrome test.
- **Edge:** existing capture implementation retained. Previous v0.4.0 native tests remain recorded in ANISONGDB_EDGE_EVIDENCE.md; no new v0.5.0 tab-audio capture was run here. The verified owned helper was restarted with updated exact-origin checks, preserving its configured origins; `/health` reports healthy with the original Edge origin allowed.
- **Safari:** browser-targeted source bundle generated; no Xcode project, signed app, native Safari run, or macOS/iOS audio-file verification was possible on this Windows machine. Apple packaging/signing on a Mac is still required.

## Ready status

Ready for local installation/testing of the generated targets, with the limited Firefox/Safari file/manual feature set explained in BROWSER_SUPPORT.md. **Not a claim of live tab-capture parity, native verification in all browsers, or store-ready distribution.** Remaining gates: native Chrome full capture test, native Firefox file/manual tests once app access is available, Safari packaging/native tests on a Mac, and Firefox distribution consent declaration/signing before AMO publication.
