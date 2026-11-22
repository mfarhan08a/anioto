# Edge submission — Anioto 0.10.6

Submitted on 23 November 2026 through Microsoft Partner Center.

- Observed status after submission: **In review**.
- Microsoft message: “Microsoft is reviewing your submission currently. Expect to hear back from us in 7 business days.”
- Visibility: Public; language: English (United States); category: Entertainment.
- Store ID: `0RDCKGG7513N`.
- CRX ID: `jbnlofkgdcmfkpafncbenbhbmoicpnnk`.
- Production package: `Anioto-0.10.6-edge.zip`, 144,357 bytes.
- SHA-256: `d9b011d528dc465003a65a13b438ecd4df4ac88e1448bfe32cfc74f1606ba3fc`.
- [Public release and Windows companion](https://github.com/mfarhan08a/anioto/releases/tag/v0.10.6).
- [Companion setup](https://github.com/mfarhan08a/anioto/blob/main/docs/WINDOWS_COMPANION.md).
- [Privacy policy](https://github.com/mfarhan08a/anioto/blob/main/PRIVACY.md).

The release uses SongRec by default, with Local Shazam selectable. AudD is
unavailable. Audio recognition requires the Windows x64 companion. Manual anime
lookup works without it. The uploaded package has no placeholder cloud host.

Updated the store description and privacy permission explanations to match this
scope. Certification notes include public companion installation instructions,
the official extension ID, a live audio test, manual search, and validation details.
All five Partner Center sections were complete before submission.

Verified all four GitHub release assets were uploaded. Downloaded the public Edge
ZIP and confirmed its SHA-256 matches the submitted archive. Build, typecheck,
lint, 410 extension tests, 30 helper tests, and actual production Windows installer
and native-host checks passed; see PRODUCTION_PACKAGE_0.10.6.json and
PRODUCTION_NATIVE_TEST.json for package and native-host evidence.

**This records successful submission, not store approval or public availability.**
Partner Center had not supplied a public store URL when the submission entered
review. Microsoft controls certification and publication.
