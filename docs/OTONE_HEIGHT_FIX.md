# Native popup height fix · v0.7.1

The user's screenshot showed a collapsed content area between the header and fixed controls. The v0.7.0 body used `height:min(560px,100dvh)` with a zero minimum. In an auto-sized extension popup this creates a viewport/content sizing dependency that the normal browser fixture did not reproduce.

The popup document and body now request an explicit 390×560px size with a 560px minimum height; the existing middle flex region remains scrollable. This removes the dynamic-viewport-height dependency. No JavaScript, recognition, permissions or dependencies changed.

All four browser packages build. The nine built-popup UI tests pass. Previous v0.7.0 type/lint/full-suite evidence applies to unchanged TypeScript; this CSS-only fix did not repeat the full suite.

Native Edge inspection on 2026-11-04 showed the installed popup at full height, with JUJUTSU KAISEN Season 2 artwork, more than words by Hitsujibungaku, the total timer and bottom controls visible simultaneously. That recognized result came from the user's activity; the agent did not perform a new audio-recognition test. Subsequent navigation testing could not be completed while the user was switching videos and closing the popup. No native screenshot artifact was saved; the full-height popup was visually observed in Computer Use output.

Close and reopen the popup to load updated CSS. Reload the extension manager entry to update its reported version to v0.7.1.
