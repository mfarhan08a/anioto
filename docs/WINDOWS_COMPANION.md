# Install Anioto's Windows companion

SongRec and Local Shazam require this one-time setup on Windows x64. Manual song
search works without it. AudD is unavailable in the first Edge store release.

1. Download [Anioto 0.10.6 Windows companion](https://github.com/mfarhan08a/anioto/releases/download/v0.10.6/Anioto-0.10.6-Windows-x64.zip)
   and its [SHA-256 checksum](https://github.com/mfarhan08a/anioto/releases/download/v0.10.6/Anioto-0.10.6-Windows-x64.zip.sha256).
2. Extract the ZIP to a folder. Do not run the installer from inside the ZIP.
3. Double-click **Install-Anioto.cmd**. No administrator account is needed.
4. Setup downloads SongRec 0.8.2 directly from its
   [official GitHub release](https://github.com/marin-m/SongRec/releases/tag/0.8.2),
   verifies its pinned SHA-256, and installs the companion for your Windows user.
   Keep an internet connection available during setup. The terminal displays
   setup progress; press a key when it finishes.
5. Install Anioto from Edge Add-ons when its listing is available. Open the
   extension, play a music track, and choose **Detect anime from this tab**.

The installer is unsigned. Review its open-source PowerShell and launcher files
before running it. If Windows blocks execution, inspect the warning and decide
whether to proceed; do not disable system-wide security settings. Report errors
through [GitHub Issues](https://github.com/mfarhan08a/anioto/issues), without keys
or private audio.

The helper starts when you open Anioto and a local provider is selected. It is
linked to the browser's native connection and shuts down when that connection
closes. Choose **SongRec** (default) or **Local Shazam** in Settings. Both use
unofficial Shazam integrations; recognition requires network access to Shazam.

## Verify a download

In PowerShell, run `Get-FileHash .\Anioto-0.10.6-Windows-x64.zip -Algorithm SHA256`
and compare it with the `.sha256` file. Do not install a mismatched archive.

## Remove the companion

Close Edge and Chrome, then run `Install-Anioto.cmd -Uninstall` from the extracted
folder. This removes that companion version and its native-host registration.
Removing the browser extension alone does not remove the Windows companion.

## What is installed

Files are installed under `%LOCALAPPDATA%\Anioto\Companion\0.10.6`. Only the
current user's native-host registry entry is changed. The Edge package is bound
to CRX ID `jbnlofkgdcmfkpafncbenbhbmoicpnnk`; it does not authorize arbitrary
websites or other extensions. Test/development extension IDs are different.

The companion includes Python 3.13.17, ShazamIO 0.9.0, pinned Python dependencies,
and Anioto's native bridge. SongRec is downloaded from its original distributor,
not redistributed in Anioto's production ZIP. License files are retained with
the runtime. See [component notices](COMPANION-NOTICES.md), the
[Python component inventory](COMPANION_PYTHON_COMPONENTS.json), and
[privacy policy](../PRIVACY.md).
