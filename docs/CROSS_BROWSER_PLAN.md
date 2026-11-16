# Cross-browser implementation plan

Baseline: retain the existing working Edge capture flow, add Chrome packaging, and provide explicitly limited Firefox/Safari builds. The user was asked whether to prioritize native-companion live capture instead; no answer arrived during implementation, so this reversible first implementation follows the stated recommended file/manual assumption. It does not treat elapsed time as approval for a native companion or publishing.

## Browser boundaries

- Chrome/Edge: existing Manifest V3 service worker, tabCapture stream ID, offscreen document. Minimum Chrome 120 matches the existing compilation target. No change to audio acquisition.
- Firefox: separate no-background manifest; popup opens a visible extension workspace. Manual song-to-anime lookup and user-selected audio file recognition reuse the existing providers. No claim of whole-tab audio capture.
- Safari: same visible workspace, packaged as source for Apple's Safari web-extension converter on macOS/Xcode. It cannot be compiled or natively verified on this Windows machine. No live tab capture claim.
- Shared providers: keep song recognition, artist/title matching, optional artwork, version handling, cache, cancellation, and network deadlines in existing modules.
- Local helper: accept a configured set of exact browser-extension origins, never arbitrary web origins or wildcard CORS. Keep localhost binding, Host check, marker, body-size/duration limits, single-worker concurrency, and no request/audio logging.

## Data and safeguards

Portable mode keeps entered AudioTag keys in page memory only. Audio selection alone does not transmit; an explicit Identify action and unchecked-by-default disclosure gate recognition. Decode actual file content, bound input size/duration/channels, export only the first provider-appropriate 12/15 seconds as existing 32 kHz mono PCM WAV, and release audio resources. Manual lookup sends only title and artist. Render untrusted provider text via textContent and allow only HTTPS result links/artwork.

Trade-off: a visible workspace must stay open until the job completes; this avoids pretending a Chromium offscreen API exists in other browsers. File/manual mode is narrower than the user's current Edge experience. Media-element capture in Firefox could be an experimental follow-up, with cross-origin/DRM and multi-element limitations. Safari full live capture needs further platform/native-companion research and a Mac.

## Phases and checks

1. Generate separate browser manifests/builds while keeping `dist` as the existing Edge-compatible root. Validate every generated entry and ensure Firefox/Safari omit unsupported Chromium permissions/background/offscreen code.
2. Add portable visible workspace and bounded audio-file conversion; test decoded-audio boundaries and UI/job lifecycle.
3. Extend exact-origin helper configuration and test allowed second-browser origins plus malicious-origin rejection.
4. Run build → types → lint → tests/coverage → dependency audit and inspect affected paths.
5. Native verification where available. Chrome/Firefox are installed; loading a new extension is a separate UI installation step. Record what was actually verified. Safari Xcode conversion/signing/native verification remains a macOS task.

## Primary references checked 2026-11-02

- https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
- https://github.com/mdn/browser-compat-data/blob/main/api/MediaDevices.json
- https://github.com/mdn/browser-compat-data/blob/main/api/HTMLMediaElement.json
- https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari
