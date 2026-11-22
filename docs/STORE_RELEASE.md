# Anioto store release

The Windows store edition uses SongRec by default. Settings also offers Local Shazam and AudD. Each scan uses the selected recognizer. The development build still supports its existing personal AudioTag setup.

For the first public Edge release, AudD is visibly unavailable. Build with
`--local-only`; this mode has no cloud endpoint or cloud host permission.

## First public Edge build (local recognizers)

1. Use Node 22.12 or newer. Run the normal build, typecheck, lint, extension
   tests and helper tests.
2. Set `ANIOTO_HELPER_URL` to
   `https://github.com/mfarhan08a/anioto/blob/main/docs/WINDOWS_COMPANION.md`.
   Run `node scripts/build.mjs --store --local-only --browser=edge`.
3. Verify the pinned helper runtime with `setup-helper.ps1 -Store` in a clean
   release checkout. Run
   `scripts/package-store.ps1 -EdgeId jbnlofkgdcmfkpafncbenbhbmoicpnnk` without
   `-AllowTestConfiguration`. The production ZIP's installer obtains SongRec
   directly from its official release rather than redistributing its runtime.
4. Inspect the ZIPs, verify checksums, and test companion install, native-host
   startup, registration and browser-disconnect cleanup. Publish the Windows ZIP,
   checksum, source/build information and installation instructions on GitHub.
5. Upload `Anioto-0.10.6-edge.zip` to the existing Partner Center product. Update
   privacy/disclosures and reviewer instructions to match local-only behavior.
   Submit for certification, then verify the resulting store status.

## Future cloud-enabled release candidates

1. From a clean checkout, use Node 22.12 or newer and `npm ci`. Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`.
2. Deploy `server/wrangler.toml` to a dedicated Cloudflare account with the recognition switch set to `false`. Set `AUDD_TOKEN` and `QUOTA_SECRET` through Wrangler secrets. Use separate deployments and credentials for tests and production. Generate `QUOTA_SECRET` with a cryptographic random generator. Configure AudD’s provider-side hard cap and confirm audio handling terms before setting `RECOGNITION_ENABLED` to `true`.
3. Set `ANIOTO_RECOGNITION_URL` to the deployment’s HTTPS `/v1/recognize` URL and `ANIOTO_HELPER_URL` to your HTTPS companion download or install page. Run `npm run build:store`. The Edge and Chrome directories are `dist-store-edge` and `dist-store-chrome`.
4. Create or upload the unpublished Edge item to obtain its extension ID. Obtain the Chrome ID the same way when preparing its release. In a clean Windows x64 release checkout, provision the pinned runtime with `scripts/setup-helper.ps1 -Store` and `scripts/setup-songrec.ps1`. The packager verifies the installed Python packages against `helper/requirements-store.lock.txt`. Consult [companion notices](COMPANION-NOTICES.md) before distribution.
5. Run `scripts/package-store.ps1 -EdgeId <official-edge-id>`. Supply `-ChromeId <official-chrome-id>` when releasing both. Publish the Windows ZIP and SHA-256 checksum on the companion download page. Users extract the ZIP, close Anioto, and double-click `Install-Anioto.cmd`. The launcher runs PowerShell with a process-scoped execution policy and installs under the current user. Use `Install-Anioto.ps1 -Uninstall` or `Install-Anioto.cmd -Uninstall` from the extracted ZIP after closing Edge and Chrome to remove that version. These initial companion packages are unsigned.

## Certification and rollout

- Confirm public-service permission for the unofficial Shazam integrations and distribution rights for the exact companion payload. Review terms for AnisongDB, AnimeThemes, AniList, and cover art. Replace any asset with unclear rights before submission.
- Publish the [privacy notice](STORE_PRIVACY.md) at a stable HTTPS URL after completing the provider retention details and support contact. Use approved screenshots and a test recording that the publisher may use. Explain the additional Windows install in the listing and reviewer notes, with the exact setup link and a reproducible test.
- On clean Windows profiles, test store install, helper install and removal, reboot and browser-close behavior, provider persistence, cancel and retry, AudD consent and quota, manual search during outages, and unsupported or silent tabs. Observe network traffic to confirm each scan uses only its selected provider. Benchmark all three providers on the same ten cleared tracks, including Underworld by 96neko if a permitted sample is available. Record song accuracy, song-to-anime accuracy, and timing separately.
- Submit via Microsoft Partner Center as Hidden. Validate the approved build by installing it from the store on a clean machine before setting it to Public. Then repeat with an unlisted Chrome Web Store submission. Firefox and Safari distribution follow separately after file recognition, consent, and browser-specific packaging checks.
- Watch total calls and service failures during the beta. Disable cloud recognition with `RECOGNITION_ENABLED=false` if the service needs to be paused. Use a new extension version for store updates. A cloud outage leaves the local engines and manual search available.
