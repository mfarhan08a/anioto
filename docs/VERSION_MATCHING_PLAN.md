# Version matching and progress — 2 November 2026

Requested behavior: after audio recognition, find the anime for alternate recordings and covers; show visible animated progress until the lookup ends.

The recognition service continues to supply the actual recorded title and artist. Anime lookup derives a base title only from explicit recording suffixes, then queries documented song credits. Same-title matches with a different artist are possible underlying-song connections, not proof of the cover recording. Exact artist matches rank above possible covers. All candidates retain a source and evidence text. Missing catalog entries remain a coverage limit rather than invented answers.

The job owns a persisted stage start timestamp. The popup uses it for the 15-second recording bar, including after reopening. Recognition and database requests use indeterminate animation because their completion time is unknown. Reduced-motion preferences disable animation. Terminal jobs stop the indicator; a newly started job clears stale results. The identified song remains visible during anime lookup without a premature no-match message.

Work order: implement resolver fallbacks and candidate evidence; implement progress state and UI; integrate job timestamps and intermediate song updates; run build, types, lint, behavioral tests; exercise real catalog lookups and the installed browser UI where computer control permits. Record observed results separately from mocked tests.
