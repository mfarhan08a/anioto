# Local recognition limit fix — 2 November 2026 — v0.3.3

The screenshot's 20-attempt message was the extension's own daily counter, not an upstream Shazam or AudioTag quota. Local Shazam previously shared it with AudioTag. The helper independently imposed 30 requests/day, so changing only the popup counter would have left another block.

Local Shazam now ignores the legacy daily counter and does not increment it. Its helper no longer has an app-imposed daily cap. AudioTag still has the existing local daily cap and provider-side free-seconds preflight. One active recognition, bounded request size/duration, timeout, origin/Host/CORS checks and explicit capture clicks remain in force. Upstream Shazam throttling is independent of these local controls; no unlimited provider-service claim is made.

Verification: build, types, lint and all 118 extension tests pass. The lifecycle regression starts Local Shazam with a stored counter of 20 and confirms no debit. All 15 helper tests pass, including 35 sequential recognitions using a test recognizer and rejection of concurrent requests. Those synthetic calls do not upload music or spend provider credits.

The verified project helper process was restarted and its loopback health endpoint returned ok/provider=shazamio. The rebuilt extension is in dist at v0.3.3; the installed extension must reload to run that build. Previous quality/native-browser checks retain their separately documented status.

## Installed Edge check

Reloaded the actual extension and confirmed v0.3.3. Its current Settings selected AudioTag, so the first check correctly showed the separate AudioTag cap. Changed only the recognition provider to Local Shazam and verified Settings saved; no API key was read or printed. The helper was already healthy after restart.

The live check also exposed a real bug in the preceding audio-quality build: Chromium rejects legacy tab-source mandatory constraints combined with standard audio constraints. Removed the mixed constraint keys and added a regression assertion for the valid legacy-only source shape. Rebuilt, repeated build/types/lint/all118tests, and reloaded Edge again. Identify on the public Orange instrumental then entered **Recording tab audio / Capturing a12-second sample**, with no daily-limit or malformed-constraint error. The full live request then recognized **Orange** by **seven oops** (Orange - Single) from the actual instrumental tab. Neither daily-cap message reappeared, and the malformed-constraint error was absent. The separate AnimeThemes request timed out at25seconds, so this run does not prove anime lookup availability; it does prove actual capture and local recognition work after the quota/capture fixes.
