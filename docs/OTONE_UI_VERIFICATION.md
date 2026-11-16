# Otone artwork UI · v0.7.0

The user selected the artwork proposal and authorized implementation. The extension is now named **Otone - Anime Song Finder**. The existing unpacked folder and extension identity are preserved; keys, preferences, personal matches and history use the existing storage contracts.

## Delivered behavior

- Compact Otone header, anime/artwork first, recognized song second, all alternative connections below. Original provider order is retained; possible connections are not promoted to confirmed.
- Full evidence, source links, recording references, and album names are available in native expanders. Images reserve space, secondary artwork is lazy, and a failed/missing image gets a decorative placeholder.
- Persistent Identify/Cancel, total/stage timer, and navigation. Search, History, and diagnostic audio checks use separate views instead of extending the result page.
- First anime publication scrolls the result view to the top once. Optional artwork updates do not change navigation or scroll position. Opened credit expanders are retained for the same job, with source focus restoration.
- System fonts and CSS-only active progress / short result entrance; reduced motion disables animation. No frontend framework, runtime icon/font dependency, new permission, or recognition-provider change.
- Edge/Chrome receive this popup. Existing Firefox/Safari file/manual workspaces receive Otone names, retaining their existing layouts and limitations. Settings labels are rebranded.

## Validation, 2026-11-04 (Asia/Bangkok)

Build all four packages, TypeScript and ESLint pass. **231 tests in 18 files pass**; imported-module coverage is 86.30% statements / 92.72% lines. The built-popup tests add artwork-first ordering, alternative retention, safe links, collapsed evidence, navigation/focus, scrolling only on first anime publication, and retaining the user's view during metadata updates. Existing capture/progressive recognition/cancellation/provider regressions pass.

Audit: zero high/critical advisories, ten existing moderate development-tool advisories. No dependency changes were introduced. Repository files were already untracked, so no meaningful tracked git diff was available; the changed runtime paths and packaging were reviewed directly.

Browser visual/interaction checks used the **actual built popup**, served locally with explicitly mocked browser APIs and known example metadata; these fixtures cannot capture or submit audio. Real AniList artwork was loaded for the long Alya title. The 390×560px layout showed the primary result and fixed controls; content scroll width equaled client width (380px), without horizontal overflow. Missing-artwork fallback was also inspected. [Screenshot](OTONE_POPUP_FIXTURE.png).

Search submission, history navigation, source expanders, active elapsed timer/progress, cancellation and keyboard order were exercised. Search moves focus to its heading; Tab from title moves to artist. Recognition moves focus to Cancel; keyboard cancellation restores Identify. Metadata updates do not force a different view. The elapsed timer remains outside live announcements.

Test-only axe-core 4.10.3 (not an extension dependency) reported zero violations under WCAG A/AA tags for Result, Search, History, More, and active recognition. [Raw results](OTONE_A11Y_RESULTS.json). This is partial automation/manual evidence, not full accessibility conformance. Reduced-motion rules were reviewed; OS preference toggling and exhaustive zoom/assistive-technology checks were not performed.

The popup JavaScript is approximately 17.8KB uncompressed, with approximately 8.5KB standalone CSS. It uses no additional runtime network requests beyond existing artwork/provider traffic. This is a compact framework-free implementation, not a measured recognition-speed improvement or a claim that its byte size decreased.

Native installed-extension reload and a fresh native song run are not yet verified for this UI patch. The recognition engine is unchanged from v0.6.5. Reload the existing unpacked extension to apply v0.7.0.

Development fixture: `node scripts/serve-ui-preview.mjs`, localhost 18743. Accessibility checks additionally need a test-only `local-data/axe.min.js`; the fixture page has no real browser settings, keys, or audio access.
