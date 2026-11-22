# Store edition implementation verification

## Production local-only package: 0.10.6 — 23 November 2026

The user approved launching with SongRec and Local Shazam. The production Edge
ZIP has no `.example` host permission or cloud endpoint. AudD is visibly
disabled; stale cloud preferences recover to SongRec, and direct AudD calls
fail without a network request. Cloud-enabled build support remains available
for a future configured release.

Build/typecheck/lint, 410 extension tests and 30 helper tests passed. ZIP contents
and checksums passed. The production installer was run for the current Windows
user: pinned official SongRec download/hash verification, repeat installation,
official Edge ID registration, native messaging startup, website-origin rejection,
SongRec version, ShazamIO import and disconnect shutdown all passed.

The companion ZIP does not redistribute SongRec's Windows runtime. It downloads
the pinned original release during installation. All 18 redistributed Python
distributions retain installed license files; inventory is published alongside
the source. Companion download/install and privacy pages are prepared for GitHub.

See [production artifact report](PRODUCTION_PACKAGE_0.10.6.json),
[native test report](PRODUCTION_NATIVE_TEST.json), and
[publication plan](EDGE_PUBLICATION_PLAN.md). These checks do not themselves
constitute Microsoft approval or a live store installation. The historical
test/cloud-preparation records below remain for traceability.

## Latest package build: 0.10.6 — 23 November 2026

The latest merged lookup fixes have been rebuilt into version 0.10.6. All six
browser/build variants, typecheck, lint, 408 extension tests, and 30 helper tests
passed. ZIP integrity, contents, and checksums passed. The current full audit
reports no high/critical advisories and six moderate development advisories.

These remain **test packages** with `.example` URLs and development/test browser
IDs. The publisher confirmed production configuration is not set up. They are
not certification-ready and do not resolve the publication work listed below.
See [build details](BUILD_0.10.6.md) and [artifact checksums](PACKAGE_0.10.6.json).

## Verified locally on 2026-11-18

| Check | Result |
| --- | --- |
| Four existing browser builds | Passed |
| Separate Edge and Chrome store builds | Passed with reserved `.example` test URLs |
| TypeScript and ESLint | Passed |
| Vitest | 364 tests passed across 22 files |
| Coverage | 86.58% statements, 93.27% lines, 77.71% branches |
| Python helper regression tests | 30 passed, including disconnect cancellation and recognition lock release |
| Windows companion | Per-user install, repeated install, ShazamIO import, SongRec executable, and uninstall passed |
| Store package inspection | Extension archive contains browser assets and bundles, with separate companion archive |
| Production dependency audit | Zero reported vulnerabilities with `npm audit --omit=dev` |
| Full development dependency audit | 12 affected dependency entries, including 7 high and 5 moderate |

Node 24.22.1 was used explicitly for the verification commands because the first Node executable on this machine’s PATH is Node 20.15.0. The project requires Node 22.12 or newer.

The full dependency audit includes [picomatch ReDoS](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), for which the advisory lists no patched version, and [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). The affected dependencies are development tools. The full audit gate remains open.

## Publication work remaining

The generated store artifacts use test URLs and development/test extension IDs. They must be rebuilt with the deployed recognition endpoint, companion download URL, and official store extension IDs. The companion is currently an unsigned ZIP with an interactive Windows launcher and a PowerShell installer.

Live AudD requests, a deployed Cloudflare Worker integration test, and the ten-song three-provider benchmark remain unverified. AudD credentials and cleared input clips are required for those checks. No official store install, reviewer approval, or publisher verification has been performed. Complete the privacy notice, component licensing/source inventory, Shazam service-permission review, artwork provenance check, publisher enrollment, and store listing assets before submission. Follow [the release procedure](STORE_RELEASE.md).
