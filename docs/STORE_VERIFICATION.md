# Store edition implementation verification

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
