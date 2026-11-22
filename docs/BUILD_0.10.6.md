# Anioto 0.10.6 package build

Built on 23 November 2026 from the merged anime lookup fixes on main, with the
package, lockfile and browser manifest versions raised from 0.10.5 to 0.10.6.
The recognition workflow and provider selection are unchanged.

## Configuration status

These are **test packages**, not store-submission artifacts. The publisher
confirmed that production configuration has not been set up. The archives use:

- Recognition endpoint: `https://anioto.example/v1/recognize`
- Companion setup link: `https://anioto.example/companion`
- Edge development ID: `oeamoddpghhjhhakjimcelbhjpjfboba`
- Chrome test ID: `abcdefghijklmnopabcdefghijklmnop`

The companion is tied to those IDs. It will not authorize a newly assigned
store extension ID until rebuilt with that ID. The `.example` links are not
working production services. Do not submit these archives for certification.

## Artifacts

All files are generated under the ignored `release-out` directory:

- `Anioto-0.10.6-test-edge.zip` — Edge store-shaped extension bundle
- `Anioto-0.10.6-test-chrome.zip` — Chrome store-shaped extension bundle
- `Anioto-0.10.6-test-Windows-x64.zip` — separate Windows companion
- A `.sha256` file alongside each ZIP

The helper is not bundled inside the browser extension ZIP. Users would install
the Windows companion separately. The generated development build in `dist`
also contains the latest fixes and version 0.10.6 for existing local users.

## Validation

Four development browser builds and the Edge/Chrome store test builds passed.
TypeScript, ESLint, all 408 extension tests, and all 30 Python helper tests
passed. Helper socket tests required running outside the restricted network
sandbox. Dependency audit found zero high/critical advisories and six moderate
advisories in the development dependency tree.

Packaging checks verify the pinned helper runtime before copying it. Archive
inspection verifies ZIP integrity, SHA-256 sidecars, manifest versions, exact
extension contents against the freshly built bundles, presence of the latest
lookup fixes, and companion installer/runtime/configuration files. Machine-readable
sizes and checksums are recorded in [PACKAGE_0.10.6.json](PACKAGE_0.10.6.json).

## Before store submission

Set up the real recognition endpoint and companion download/install page, obtain
the official Edge extension ID from Partner Center, and rebuild without
`-AllowTestConfiguration` following [STORE_RELEASE.md](STORE_RELEASE.md). Complete
the outstanding clean-profile and certification checks in
[STORE_VERIFICATION.md](STORE_VERIFICATION.md). This build does not claim a new
live audio recognition test or Microsoft approval.
