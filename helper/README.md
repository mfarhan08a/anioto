# Local recognition helper

This is a personal-use, experimental alternative to the AudioTag recognition adapter. It uses ShazamIO, an unofficial client for a reverse-engineered Shazam API. Shazam can change or block the protocol; recognition access, accuracy, and availability are not guaranteed. It has no Shazam-issued API key and does not provide an official Shazam service guarantee. The sample is fingerprinted through the local ShazamIO library, which queries Shazam for recognition. This provider successfully recognized the supplied Novelbright test track in a real Edge tab; see [live evidence](../docs/LIVE_TEST_EVIDENCE.md).

The helper also supports SongRec, a local fingerprinting client for Shazam’s online catalog. It runs only on `127.0.0.1:18742`, handles one recognition at a time, rejects WAV files over 1 MB or 20 seconds, and analyzes up to 12 seconds of PCM audio. SongRec uses a temporary WAV file that the helper removes after recognition or cancellation. The helper keeps no recognition history and logs no request details.

The built-in origin is `chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba`. The helper can allow multiple explicitly configured browser extension origins. Use `ASF_EXTENSION_ORIGINS` as a comma-separated list of exact origins; the older single-origin `ASF_EXTENSION_ORIGIN` variable remains supported and is added to that list when both are set. When neither variable is set, the built-in origin is used.

Supported exact origin forms are `chrome-extension://<32-character-id>` (Chrome and Edge), `moz-extension://<uuid>` (Firefox), and `safari-web-extension://<uuid>` (Safari). IDs and UUIDs are validated; paths, credentials, ports, wildcards, `null`, and ordinary HTTP or HTTPS origins are rejected. CORS checks, the required `X-Anime-Song-Finder: 1` marker, and exact `Host: 127.0.0.1:18742` checks are enforced. The service exposes `/health` and `POST /recognize`; it does not expose a web page or unauthenticated LAN interface. A health response reports `allowedOrigins` only to callers without an Origin header or with an allowed extension origin.

## Setup and run

In PowerShell from the repository root:

```powershell
.\scripts\setup-helper.ps1
.\scripts\setup-songrec.ps1
.\scripts\start-helper.ps1 -ExtensionId oeamoddpghhjhhakjimcelbhjpjfboba
```

`setup-songrec.ps1` is needed only for SongRec. It verifies the official standalone Windows release and extracts it into ignored `local-data/songrec/`. Then select **SongRec** in Anioto’s **Recognition provider** settings. Select **ShazamIO** to switch back. If the helper was already running when you updated Anioto, restart it once to pick up the new endpoint. For manual setups on other platforms, SongRec must be available on the helper’s `PATH`.

For Firefox or Safari as well, pass additional origins while retaining the default Edge/Chrome origin:

```powershell
.\scripts\start-helper.ps1 -ExtensionId oeamoddpghhjhhakjimcelbhjpjfboba -ExtensionOrigin @(
    'moz-extension://123e4567-e89b-12d3-a456-426614174000',
    'safari-web-extension://123e4567-e89b-12d3-a456-426614174001'
)
```

Use the extension ID shown for your installation at `edge://extensions` as the ExtensionId argument; unpacked extension IDs can change when the installation path changes. The default matches the original personal installation only. `-ExtensionOrigin` adds exact Firefox, Safari, or additional Chromium origins. If a helper is already running without all requested origins, the launcher reports the missing origins and asks you to stop the helper manually before relaunching with the combined list. It does not stop an unknown process. Run these local scripts in a PowerShell environment permitted to run the project scripts; the scripts do not change execution policy. The setup downloads the official Python 3.13.17 Windows embeddable archive, verifies its SHA-256 checksum, and installs Python and pinned ShazamIO packages under the ignored `local-data/` directory. It does not modify global Python, PATH, registry, file associations, or user credentials. FFmpeg is not required: the pinned ShazamIO core decodes WAV directly.

On macOS or Linux, use a Python installation that can install the pinned helper dependency, then launch `helper/server.py` from this repository with the same origin environment variable. For example:

```sh
python3 -m pip install -r helper/requirements.txt
ASF_EXTENSION_ORIGINS='chrome-extension://<32-character-id>,moz-extension://<uuid>,safari-web-extension://<uuid>' python3 helper/server.py
```

Set the variable only to the origins needed by your browser installs. Existing configuration is validated at helper startup. The launcher and dependency setup are Windows-specific; this manual command does not install the project’s Windows runtime or run any additional downloads beyond the package installation you choose to perform.

Removing `local-data/` removes the local Python runtime, dependencies, and cached installers. Stop the helper by ending its `python.exe` process in Task Manager. The helper does not start automatically; use the launcher when needed.

## Endpoint

`GET /health` returns `{ "ok": true, "provider": "shazamio", "allowedOrigins": [...] }` to callers with no Origin or an explicitly allowed extension Origin.

`POST /recognize` selects ShazamIO and `POST /recognize/songrec` selects SongRec. Both accept `audio/wav` bytes, the exact extension `Origin`, and `X-Anime-Song-Finder: 1`. Both return `{ "songs": [...] }` or `{ "songs": [] }` on a miss. Provider errors are sanitized.
