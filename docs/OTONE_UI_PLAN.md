# Otone artwork UI · approved implementation scope

User selected the Otone artwork proposal, then explicitly authorized implementation. Implement in the existing popup, without a frontend framework, font download, analytics, new permission, or recognition changes.

- Compact brand/settings header, one scrollable content area, persistent Identify/Cancel and Result/Search/History/More navigation.
- Primary anime hero first, moderate reserved cover space, title, source match kind, theme type. Recognized song text below; album and evidence collapsed. All alternative associations remain accessible without inferred confidence rankings.
- Separate existing manual search, history, and diagnostic preview into navigation views. Preserve existing browser storage, overrides, source-link validation, recording controls and elapsed timing.
- On a new result, reveal the first anime once. Do not yank scrolling or navigation on optional artwork updates. Preserve opened credits on the same request and keyboard focus when source nodes refresh.
- Use CSS-only active loading/brief result motion, system font, deferred secondary covers, fixed artwork dimensions and a fallback. Respect reduced motion. Keep identifying and cancellation keyboard accessible with focus recovery.
- Rebrand extension metadata and companion page labels as Otone. Edge/Chrome get the new artwork popup; existing Firefox/Safari file/manual workspaces retain their current layouts with updated names.

Validation: actual built popup lifecycle/navigation/scroll/order tests, build/types/lint/coverage/audit, browser visual fixture checks at 390px with long titles/multiple possible matches, empty/loading/cancel/manual/history/source details. Native extension reload is separate from fixture evidence. No claim of WCAG conformance or faster recognition follows from a UI rework.
