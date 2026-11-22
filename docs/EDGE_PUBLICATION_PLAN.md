# Edge first release

Approved scope: SongRec by default, Local Shazam selectable, AudD visibly
unavailable until a later configured release. No cloud recognition hosting or
AudD key is required for this release.

Observed Partner Center identity on 23 November 2026:

- Product ID: `029c38e6-35f2-4804-b68f-b56e9726a697`
- Store ID: `0RDCKGG7513N`
- CRX ID: `jbnlofkgdcmfkpafncbenbhbmoicpnnk`
- Draft version: 0.10.5, Public visibility, all listing sections complete.
- Uploaded draft package is still the 0.10.5 test ZIP with `.example` permission.

Implementation sequence:

1. Add an explicit local-only store build, with a null cloud endpoint, no cloud
   host permission, a disabled AudD option, and guards against stale cloud
   preferences or direct cloud calls. Keep cloud-enabled builds and development
   AudioTag support intact. Test settings, request guards, and build contents.
2. Publish companion installation documentation and prepare the Windows package
   for the official CRX ID. Inventory actual shipped dependencies, licenses and
   corresponding source information before distributing the companion.
3. Build immutable production ZIPs, run checks, verify checksums and contents,
   and test installation/native messaging with the official ID.
4. Publish companion downloads and source/build information on GitHub. Verify
   public links, update the privacy policy and store disclosures, then replace
   the draft extension package with the production ZIP.
5. Verify listing and reviewer instructions against the final package. Submit
   for certification and inspect the resulting status. Microsoft controls the
   approval and publication timeline; a draft or submitted status is not live.

Browser submission is authorized by the user's request to complete publication.
Any new account login, legal agreement or unavailable credential will be surfaced
only when it is actually needed. No placeholder cloud URL will be presented as
production-ready.
