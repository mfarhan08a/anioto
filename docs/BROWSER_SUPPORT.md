# Browser support — v0.5.0

These are different build targets, not a claim that every browser supports the same capture APIs.

| Browser | Build folder | Live tab audio | Audio-file identification | Manual song lookup |
| --- | --- | --- | --- | --- |
| Edge 120+ | `dist` | Yes; real audio flow tested in v0.4.0 | Not in its popup | Yes |
| Chrome 120+ | `dist-chrome` | Same Chromium implementation; native test pending | Not in its popup | Yes |
| Firefox 128+ desktop | `dist-firefox` | Unavailable in this build | Portable workspace | Portable workspace |
| Safari 17+ macOS | `dist-safari` | Unavailable in this build | Portable workspace source | Portable workspace source |

Safari source must be packaged as an Apple app/extension using Xcode on a Mac before installation. It is not a ready-to-install Safari app. No Safari native test or iPhone/iPad support claim is made.

## Build

Use Node 22.12+ and run `npm run build` for all four folders. To build one target, use `npm run build:chrome`, `npm run build:firefox`, `npm run build:safari`, or `node scripts/build.mjs --browser=edge`. The existing Edge unpacked path stays `dist`.

## Chrome

At `chrome://extensions`, use Developer mode → Load unpacked → `dist-chrome`. Open Settings and choose the desired recognition service. AudioTag uses your own API key/free allowance; Local Shazam needs the helper configured for the Chrome extension ID shown on that installation's extension card. IDs can differ by browser and unpacked folder. The original Edge ID must not be assumed to be Chrome's ID.

To keep Edge and Chrome allowed together, start the helper with both origins:

```powershell
.\scripts\start-helper.ps1 -ExtensionId oeamoddpghhjhhakjimcelbhjpjfboba -ExtensionOrigin 'chrome-extension://YOUR_CHROME_EXTENSION_ID'
```

Replace the placeholder with the actual 32-character ID. A helper already running with a different allowlist must be stopped and restarted; the launcher reports this instead of silently saying the browser is ready. See the helper README for exact-origin configuration.

## Firefox

For a local temporary test, open `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → choose `dist-firefox/manifest.json`. The temporary installation lasts until Firefox exits. Use the extension's popup to open its workspace in a tab and keep that tab open until the search completes.

Audio-file mode explicitly requires your upload consent before recognition. Local Shazam accepts files of at least five seconds and processes up to the first 12 seconds; AudioTag needs at least 15 seconds and processes the first 15 seconds after its free-seconds preflight. Inputs must be at most 10 MB, no longer than 60 seconds, and mono/stereo. Supported compressed formats depend on the browser decoder; WAV is the simplest shared option. A selected file is not transmitted merely by choosing it. No microphone or screen capture is requested.

AudioTag keys remain in the workspace's memory and are never saved. This first portable workspace does not include the Edge popup's history/personal-match settings. Manual lookup needs only title and artist, with no audio or recognition key.

For Local Shazam, expand the helper configuration disclosure in the workspace and copy its exact `moz-extension://...` origin. Use that origin in `-ExtensionOrigin`, retaining any Edge/Chrome origins you need. Firefox's runtime origin differs from its fixed add-on ID, so do not pass `anime-song-finder@local` as an origin. Host access may need to be granted for the selected provider by Firefox's extension UI.

The Firefox build is for local development. Permanent distribution requires Mozilla signing and review of the current Add-ons data-collection/consent requirements; this repository has not been submitted to AMO.

## Safari on a Mac

Apple's current tool is `safari-web-extension-packager` (older Xcode versions call it `safari-web-extension-converter`). With this repository and its built `dist-safari` folder on the Mac:

```sh
xcrun safari-web-extension-packager ./dist-safari --project-location ./safari-project --app-name 'Anime Song Finder' --no-open
```

If your Xcode only provides the older name, replace `safari-web-extension-packager` with `safari-web-extension-converter`. Open the generated Xcode project, configure a unique bundle identifier and signing team, build/run it, then enable the extension in Safari. Packaging, signing, and required Safari website permissions are performed on that Mac. App Store distribution is a separate step.

Run the local helper on the same Mac if selecting Local Shazam; the Windows helper is bound to Windows localhost and cannot serve a different computer. Install `helper/requirements.txt` in a Python environment, then run `helper/server.py` with `ASF_EXTENSION_ORIGINS` containing the exact Safari extension origin shown in the workspace. See `helper/README.md`. AudioTag can be selected instead without a local helper.

## Why capture differs

The Chromium flow needs `tabCapture.getMediaStreamId` and an offscreen document. Renaming `chrome` to `browser` cannot supply missing APIs. MDN's current compatibility data does not list Firefox/Safari audio capture through `getDisplayMedia`; Firefox media-element capture is a possible future, narrower approach, while Safari lacks `HTMLMediaElement.captureStream`. Live capture parity would need additional browser-specific work or a native companion, including testing DRM/cross-origin and platform constraints.

Sources checked 2026-11-02:
- https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
- https://github.com/mdn/browser-compat-data/blob/main/api/MediaDevices.json
- https://github.com/mdn/browser-compat-data/blob/main/api/HTMLMediaElement.json
- https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari
- https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/
