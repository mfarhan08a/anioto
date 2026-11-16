# Open Otone to start recognition

The local helper starts on demand when Local Shazam is selected and the user opens Otone. Further popup opens reuse it. Identify also checks readiness to recover if the helper was stopped later. Since v0.8.7, the helper started by Otone shuts down a few seconds after the last attached Edge or Chrome browser closes its windows.

## One-time Windows setup

Run `scripts/setup-helper.ps1` if the local Python runtime has not been installed, then run:

```powershell
.\scripts\install-native-helper.ps1
```

When upgrading an existing installation to v0.8.7, rerun the installer to replace the launcher executable, then reload the unpacked extension. If an older detached Otone helper is still running, exit that helper once before reopening Otone. The installer registers the exact origin with the current-user Edge and Chrome NativeMessagingHosts keys. Other Chrome extension IDs can be added explicitly with `-AdditionalExtensionId`.

After a reboot, open Otone and allow a short moment for the first helper start. Browser launch alone does not start it. AudioTag, diagnostic previews and manual anime lookup do not require launching this helper. Firefox and Safari use the manually started helper.

Manual startup via `scripts/start-helper.ps1` keeps the helper running independently of any browser. To remove the on-demand registration:

```powershell
.\scripts\install-native-helper.ps1 -Remove
```

Removal verifies that the keys point to this project's manifest. Moving the project requires reinstalling this registration because its executable/manifest paths are absolute.

## Trust boundaries and implementation

- The popup requests a background readiness check. Concurrent requests share one native connection. The connection is released when there are no remaining browser windows. Browser process exit also closes it.
- Chromium launches `com.otone.helper` for the connection. Its manifest permits only explicitly configured extension origins. The C# wrapper runs the fixed project Python bridge with raw stdio and a bounded startup handshake.
- The Python bridge authorizes the caller and accepts only a bounded, length-prefixed `{"type":"ensureHelper"}` message. Arbitrary commands, URLs, paths and extra message properties are rejected. No audio or API key crosses this channel.
- A file lock serializes startup and final shutdown. Each attached browser holds a separate Windows lock. The automatically launched server stops and cancels any active recognition worker when the last lock is released. An existing compatible manually started helper remains available independently.

Official mechanism: [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Edge Native Messaging registration](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/native-messaging).

## Browser shutdown verification · v0.8.7

In an isolated Edge profile, the unpacked extension started the registered Windows helper after Local Shazam was selected and Otone requested readiness. The helper became healthy in about 2 seconds and stopped about 2.4 seconds after Edge exited. Two concurrent native connections also shared one helper process, releasing one connection kept it running, and closing the final connection shut it down. A forced native-host exit released the connection and shut down the helper as well. These checks used no audio.

## Verification · 2026-11-04

All four browser packages build; typecheck and lint pass. **249 extension tests in 19 files** and **25 helper/native bridge tests** pass. Imported-module coverage: 86.36% statements, 92.73% lines. Audit: no high/critical advisories; ten existing moderate development-tool advisories; no dependency additions.

The actual compiled C# executable and Python bridge were exercised with real native binary frames. A stopped helper started successfully in **2.074 seconds**; a second request returned **already-running** in **0.485 seconds** with the same helper PID. An unauthorized website origin and an unsupported command returned framed errors. This verifies a cold process start and reuse without rebooting Windows. [Raw evidence](NATIVE_HELPER_LIVE_RESULTS.json).

The native launcher is registered on this device and installed Edge Otone was reloaded and observed enabled at v0.8.0. For a native cold-start check, only the verified project helper process was stopped. Opening the actual extension popup then restarted the helper; no startup script or direct launcher was invoked between the stop and popup open. The health endpoint returned ok=true, provider=shazamio, and the exact configured extension origin. The popup visibly showed Ready when you are. See [native popup-start health evidence](NATIVE_POPUP_START_RESULTS.json) and [ready popup screenshot](OTONE_NATIVE_START_READY.png). This simulates the stopped-process state after reboot; no actual device reboot or new audio-identification run was performed.
