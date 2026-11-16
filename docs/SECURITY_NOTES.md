# Security boundaries

This is a personal browser extension, not a hosted multi-user service.

- Privilege: tab capture is permitted only after invoking the extension. API access is limited to the declared provider hosts. No content script reads visited pages.
- Sensitive data: AudioTag credential in trusted extension storage and short audio buffers in the offscreen context. Do not log or export either. Session storage is preferred; persistent storage is opt-in.
- Untrusted data: provider JSON, imported personal matches, title/artist input and returned URLs. Validate shapes; render strings through textContent; allow HTTPS links only.
- External dependencies: AudioTag can fail, change quotas or retain submissions under its own policy. AnimeThemes and AniList can fail or omit associations. Preserve partial results instead of inventing matches.
- Spending: check known remaining free seconds before upload. This reduces accidental spending but cannot prevent races if other clients use the same account. Use an account without paid credits or a provider-side cap for an authoritative zero-spend boundary.
- Availability: bounded recognition polling and metadata requests; no automatic retry of upload POSTs, no continuous listening, no analytics.

This document describes design intent and observed implementation controls. It is not an independent security audit or a guarantee of browser/provider behavior.

The optional ShazamIO helper binds only to loopback, checks the exact installed extension origin and Host, limits concurrency, samples and request size, and bounds its recognition child process. It receives no AudioTag key. Provider selection is explicit; no automatic paid fallback exists. Cover candidates retain source credits and are labeled possible, so an artist mismatch is not silently represented as confirmation. Bundled featured-song associations have reviewable sources.
