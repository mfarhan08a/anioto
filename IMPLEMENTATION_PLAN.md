# Anime song finder — local browser extension plan

Prepared: 1 November 2026. Updated to prioritize free recognition: AudioTag first, subject to verification of its free API allowance. Status: researched implementation proposal; application not built yet.

## 1. Intended result

Install an unpacked extension in your own desktop Microsoft Edge browser. While a video or stream plays, open the extension and select **Identify this tab**. It captures approximately 15 seconds of that tab's audio (initial target within AudioTag's recommended 10–30-second range), recognizes the recording, resolves supported song-to-anime associations, and displays:

- Anime title in available English, Japanese, and romanized forms; cover image; season/year when available.
- Song title, artist, album when available, and music-service links supplied by the recognition provider.
- Connection type when known: opening, ending, insert song, or soundtrack association.
- Source links and an explanation of how the anime connection was established.
- Multiple related anime when the same song has several documented uses.

The extension identifies anime associated with the music. It cannot establish which anime the visible footage comes from. A reused song can point to a different anime than the video.

Local installation does not mean offline recognition: short audio samples go to the selected recognition provider; song/anime queries go to metadata providers. No hosted application server is required for the recommended initial architecture.

Assumptions: Windows desktop; Edge first because the examples were Edge add-ons; a current supported browser; personal use; explicit identification requests; internet access. Chrome is a compatibility target. These are proposed defaults, not additional user decisions required before planning.

## 2. Recommended choices and alternatives

| Decision | Recommendation | Alternatives and trade-offs |
|---|---|---|
| Recognition | AudioTag first, behind a replaceable provider adapter; verify free access before integration | Third-party Shazam API on RapidAPI is the free-tier fallback candidate, subject to endpoint, account, and fee verification. AudD/ACRCloud are optional paid alternatives only if separately selected. |
| Runtime | Manifest V3 extension making direct HTTPS API requests | A localhost companion offers OS credential storage and more processing flexibility but needs installation, startup, authentication, and maintenance. A hosted backend adds hosting and operations. |
| Anime connection | AnimeThemes for openings/endings; targeted MusicBrainz album/recording research for OST fallback | General anime title search alone does not establish that a song belongs to an anime. Adding every anime API initially adds failure paths without solving missing song relationships. |
| Anime metadata | AniList by known external ID; retain AnimeThemes base result if enrichment fails | Kitsu is an optional fallback. MyAnimeList links can be shown from known IDs without integrating user accounts. |
| UI | Compact popup, settings page, local history | A side panel is convenient for long sessions but unnecessary for the first version. |
| Implementation | TypeScript, Vite, small framework-free UI, Vitest; Zod at external response boundaries | React is reasonable for a larger UI but adds dependencies for a small popup. Use locally bundled code, no remote executable scripts. |
| Credential | Session-only API token by default; explicit “Remember on this device” option | Remembering a personal token in extension-local storage improves convenience but is not encryption or a secret vault. Stronger at-rest protection requires a companion/native credential store. |
| Listening | One short sample per explicit request; manual retry | Automatic continuous listening increases cost, privacy impact, and lifecycle complexity. |

AudioTag is recommended as the first free candidate to evaluate, not as a proven unlimited-free service or on an untested claim of superior anime accuracy. Keep the architecture replaceable. If its free allowance is unsuitable, evaluate the fallback before proceeding; do not silently switch to a paid service.

## 3. Research findings and limits

### Recognition services

**Primary: AudioTag.** Its official FAQ advertises free API access with limitations and recommends 10–30-second audio samples. Exact renewable free quotas, automated-use conditions, account requirements, current API protocol, and response times remain to be verified. Its API document also refers to charged operations; therefore the FAQ alone does not establish unlimited or indefinitely free recognition. Start with a 15-second sample and a user-owned credential. Verify actual upload encoding and job/polling behavior before implementation. [AudioTag FAQ](https://audiotag.info/faq) · [API documentation](https://user.audiotag.info/doc/AudioTag-API.pdf)

**Fallback candidate: third-party Shazam API on RapidAPI.** The listing advertises a Basic plan at US$0 with 100 requests/day and a hard request limit, plus a separate bandwidth allowance/fee. RapidAPI's documentation says freemium subscriptions require a credit card. Verify that the free plan includes the needed audio-recognition endpoint, request encoding, renewal, account conditions, and hard-limit behavior. This is not Apple's official API. Do not activate a subscription or assume zero possible charges merely from the plan name. [Provider pricing](https://rapidapi.com/diyorbekkanal/api/shazam-api-free/pricing) · [RapidAPI billing documentation](https://docs.rapidapi.com/v2/docs/api-pricing)

**Experimental alternative: ShazamIO.** A free Python library using reverse-engineered Shazam endpoints. It would most simply require a local helper and has no verified service guarantee or ongoing access authorization. Keep outside the default implementation. [Project](https://github.com/shazamio/ShazamIO)

**Excluded for short snippets: AcoustID.** Free for non-commercial applications, but its own FAQ says short audio snippets are unsupported. Do not substitute it for the planned tab-audio workflow. [FAQ](https://acoustid.org/faq)

**Optional paid alternative: AudD.** It offers a temporary trial rather than the ongoing free access requested here. Do not make its token or subscription a prerequisite for this release. [Pricing](https://audd.io/pricing/)

ACRCloud accepts audio or fingerprints with signed identification requests, but no suitable ongoing free allowance was verified. Keep it as a separately selected paid alternative. [ACRCloud identification reference](https://docs.acrcloud.com/reference/identification-api/identification-api)

### Song-to-anime and metadata sources

- **AnimeThemes:** explicitly describes its repository as opening and ending themes. Best initial association source, not a complete background OST catalog. Its documentation describes relationships, authentication, and rate limits. [Official documentation source](https://github.com/AnimeThemes/animethemes-api-docs) · [introduction](https://raw.githubusercontent.com/AnimeThemes/animethemes-api-docs/main/docs/jsonapi/intro/index.md)
- **AniList:** anime metadata and ID/title lookup. Non-commercial API use is free, with restrictions on mass collection. Current rate-limit documentation reports a temporary 30 requests/minute limit rather than the normal 90. Read response limits and Retry-After; fetch only requested anime. [Media lookup](https://docs.anilist.co/guide/graphql/queries/media) · [terms](https://docs.anilist.co/guide/terms-of-use) · [rate limits](https://docs.anilist.co/guide/rate-limiting)
- **Kitsu:** its public API documentation supports anime text searches and public reads; useful for optional metadata fallback. Verify current endpoints before enabling an adapter. [Kitsu API docs](https://kitsu.docs.apiary.io/)
- **MyAnimeList:** preserve known external links initially. The official API reference could not be inspected through the research tool, so this plan does not assume its API can reverse-search songs. [Official API reference](https://myanimelist.net/apiconfig/references/api/v2)
- **AnimeOshi:** an accessible website was found, but no documented public song-to-anime API was verified. An `api` hostname serving a website is not proof of an integration API. Keep out of the critical path until documentation and permission for the required access are established. [Observed site](https://api.animeoshi.com/)
- **MusicBrainz:** recording/release metadata can provide OST album evidence. It is a fallback to investigate, not a guaranteed anime mapping service. Public non-commercial reads require identification and rate limiting, ordinarily at most one request/second. [API docs](https://musicbrainz.org/doc/MusicBrainz_API) · [rate limits](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- **VGMdb:** potentially valuable soundtrack data, but do not depend on the unofficial vgmdb.info service. Public API availability and permitted access would need separate verification.

Research limitation: AnimeThemes' hosted documentation and a sample API request were not retrievable through the web tool. The official documentation repository was readable. Exact search filters, relationship includes, current response shapes, browser access, rate limits, and terms still need a live integration spike before committing to endpoint details. No recognition accuracy benchmark or credentialed recognition request has been performed.

## 4. What the first usable release includes

1. First-run setup: explain outgoing audio, enter personal token, choose whether to remember it, check configuration without silently spending recognition credits.
2. Identify button, initial 15-second countdown, cancel, result, and manual retry; sample duration is provider-configured after the integration spike.
3. Tab audio capture that continues if the popup closes; reopening shows the current operation or last result.
4. AnimeThemes-based opening/ending matching and AniList enrichment.
5. Best-effort OST fallback through validated album metadata, with inferred candidates clearly distinguished from documented theme use.
6. Song-only results when anime mapping fails; song recognition remains useful independently.
7. Manual song-title/artist lookup, allowing metadata matching without another audio request.
8. A bounded history of the last 100 results, clear/delete controls, and local export/import of user-created song-to-anime overrides.
9. Settings for token removal, title language, history retention, and a conservative local request budget.
10. Installable build, setup instructions, troubleshooting, and an actual browser verification report.

Automatic listening, accounts, list syncing, source separation, offline fingerprint recognition, and public store distribution are future extensions. Opening/ending support is the reliable starting focus; full soundtrack coverage cannot be guaranteed by the available sources.

## 5. Architecture and operation

```text
Popup / settings / history
        | typed extension messages
        v
Service worker — job coordination, tab ownership, persisted status
        | capture command + single-use tab stream ID
        v
Offscreen document — audio lifecycle and in-flight request ownership
        |-- tab audio -> playback routing -> normal speakers
        |-- short recording -> recognition adapter -> AudioTag HTTPS
        |-- recognized metadata -> association resolver
        |                         |-- AnimeThemes
        |                         |-- MusicBrainz fallback
        |                         `-- AniList enrichment
        `-- result/status -> worker -> session state/history -> popup
```

An offscreen extension document owns recording and asynchronous work; the popup is only a view/controller. Avoid depending on a permanently alive Manifest V3 service worker. Use explicit job IDs, a heartbeat/status handshake, timestamps, and recovery of interrupted jobs on reconnect. Late responses must not replace newer results.

The offscreen context keeps audio bytes locally in memory and sends the provider upload itself, using the verified AudioTag protocol. The adapter must support submit/status/result operations if the API is asynchronous; use bounded polling only while a user-requested job is active. Do not pass Blob objects through Chrome's JSON extension messaging; send only validated control messages and normalized metadata. If processing outlives recording, keep the context alive only for the bounded job and close it after completion. Verify lifecycle behavior in the first spike rather than relying on undocumented keepalive assumptions.

Capture implementation:

- Request `activeTab`, `tabCapture`, `offscreen`, and `storage`; specific API host permissions only. Add optional provider permissions only when that provider is enabled. No page content script or all-sites access is expected.
- Begin only after explicit extension interaction; record the selected tab ID before focus changes. Use `chrome.*` APIs for Chromium compatibility rather than assuming newer `browser.*` aliases.
- Ensure the offscreen consumer is ready, obtain the short-lived stream ID, and consume it immediately. Feature-detect required APIs and report unsupported browsers.
- Reconnect the captured stream to an AudioContext output: tab capture otherwise suppresses normal tab playback. Prevent double playback and restore/clean up on every exit.
- Capture audio only. Start with WebM/Opus via MediaRecorder if confirmed accepted by the provider. Otherwise encode a short mono PCM WAV locally using browser audio APIs. Avoid bundling FFmpeg unless a demonstrated need arises.
- Detect prolonged silence before upload; stop tracks after the sample, cancellation, tab close, or an error. Release recorder, AudioContext, listeners, buffers, and object URLs.

Sources: [tabCapture constraints and playback](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) · [offscreen recording pattern](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture)

Suggested source layout:

```text
src/background/       job coordinator and browser events
src/offscreen/        capture, recorder, playback, job execution
src/recognition/      provider interface and AudioTag adapter
src/association/      normalization, evidence, candidate ranking
src/providers/        AnimeThemes, AniList, MusicBrainz adapters
src/storage/          versioned settings, history, overrides
src/ui/               popup, setup/settings, history
src/contracts/        typed messages and validated external payloads
tests/                matching fixtures and integration cases
public/               manifest, icons, static pages
dist/                 generated unpacked extension
docs/                 installation, privacy, verification evidence
```

## 6. Matching rules

1. Keep original title, artist, album, provider track ID, and optional identifiers. Never require an ISRC or provider confidence score.
2. Check user-confirmed local overrides using provider ID, or normalized title plus artist as fallback.
3. Normalize Unicode width, punctuation, whitespace, case, and credited artists for comparison. Preserve originals for display. Treat TV-size/version qualifiers as search variants, while retaining cover/remix/version distinctions.
4. Query AnimeThemes by supported song search, with a capped set of variants. Expand artists, theme uses, anime, and available external IDs. Validate actual endpoint behavior during the spike.
5. Rank exact title plus compatible artist above title-only candidates. A title like “Again” is insufficient by itself. Use explicit source aliases rather than assuming Japanese/romanized strings are automatically equivalent.
6. Return all documented anime uses for the matching song. Keep season IDs separate; do not collapse an entire franchise to the first series.
7. Enrich known AniList IDs directly. Only use anime-title search if no external ID is available, validating year/season before selecting an entry.
8. If themes do not resolve it, inspect recognized album data and targeted MusicBrainz recording/release evidence. A soundtrack album name may generate anime candidates; label these as inferred until corroborated by explicit relationships or user confirmation. Composer identity alone is not anime evidence.
9. Show source and evidence category: “documented theme,” “possible soundtrack association,” or “your saved match.” Do not display invented probability percentages.
10. If unresolved, show “Song identified; anime connection not found,” plus manual search/correction. A user correction is local personal data and never edits upstream databases.

Lookup budgets: at most three title variants, bounded candidate lists, short per-provider timeouts, and respect Retry-After. Bound the entire lookup, displaying song details first. Preserve the useful result if enrichment times out.

## 7. State, storage, and failures

Job states: idle -> capturing -> submitting -> awaiting recognition -> resolving anime -> complete / song-only / no song / failed / cancelled. Include provider job ID when applicable. Store job ID, target tab ID, timestamps, stage, and sanitized result, not audio, in session storage. One active job at a time; repeated clicks focus/show the existing job. Polling resumes only for a recoverable existing provider job; never resubmit audio automatically after a restart.

Persistent data: versioned non-secret settings, bounded history, and user overrides with source/provenance. Token defaults to trusted extension session storage, never sync storage; device persistence is opt-in and restricted to trusted extension contexts. Never embed a shared token in source, build, export, logs, or history. No encryption claim for Chrome local storage.

Transient lookup caching must be bounded and consistent with provider terms. Do not mirror AniList or prefetch entire catalogs. Treat personal result history separately from a metadata mirror; retain minimal result fields and refresh on demand where required. Review source terms before setting cache retention defaults.

Handle separately: unsupported page, silent audio, capture conflict, closed tab, protected media, invalid/expired token, quota exhausted, provider outage, malformed response, timeout, no song, no anime, and ambiguous anime. Cancel aborts local capture and fetch; a request already received by the provider may still be billed.

Recognition POST requests must not retry automatically after ambiguous network failures: the first request may have been processed. A fresh manual retry records a new sample and clearly spends another request. Metadata GET requests can use bounded backoff.

Use a client-side cap bounded by the verified free quota (suggested maximum 20 identifications/day only if that quota permits it) and local attempt counter. Track billed API operations separately if submission and status queries use different credits. This is a convenience limit, not an authoritative billing meter. Link to the provider dashboard for usage. Stop at the configured free allowance; do not silently purchase credits or enable paid overages. Account-level limits remain authoritative.

## 8. Privacy and security implementation

- Explain the selected provider before the first capture. Only audio from the chosen tab is submitted, never microphone or screen video.
- Keep audio in memory and discard it locally after submission/completion; describe provider retention according to its actual policy, not an assumed deletion guarantee.
- No analytics, page scraping, or remote code. Do not save page URLs or tab titles by default.
- Validate provider payloads and extension messages; render remote strings as text, not HTML.
- Restrict external links to safe HTTPS destinations and reject executable URL schemes. Permit artwork only under the necessary image policy; handle missing artwork without failing the result.
- Enforce an extension CSP compatible with the bundle, with no eval or inline executable scripts. Redact tokens and raw audio from diagnostics.
- Export only personal overrides/history explicitly selected by the user; never export credentials.

## 9. Phased implementation and checks

| Phase | Tasks | Completion evidence | Estimated effort |
|---|---|---|---|
| 0 — integration spikes | Verify AudioTag free quota/renewal, permitted automated use, credential flow, encodings, submit/poll/result protocol, latency and anime coverage. Verify AnimeThemes queries/terms, AniList ID lookup, popup-trigger capture, offscreen lifecycle. Evaluate RapidAPI fallback only if needed. | Document ongoing-free eligibility and applicable limits; a real tab sample reaches recognition and one returned song resolves to documented anime. If free access is unsuitable, record the blocker and evaluate fallback without buying a plan. | 0.5–1.5 days |
| 1 — capture foundation | Manifest, build pipeline, typed messages, job state, popup, offscreen capture, playback routing, cancel/cleanup. | Popup can close/reopen mid-capture; playback continues; no stream survives completion/cancel/tab close. | 1–2 days |
| 2 — recognition | AudioTag adapter, settings/session credential, verified upload protocol and bounded polling if needed, payload validation, silence detection, timeouts, free-quota counter, manual retry. | Live recognized song; invalid credential, silence, exhausted free quota, pending/failed provider jobs and timeouts behave correctly without duplicate submissions or paid fallback. | 1–2 days |
| 3 — anime association | Normalization, AnimeThemes lookup, evidence rules, AniList IDs, ambiguity handling, MusicBrainz OST spike/fallback. | Documented themes resolve; colliding names stay ambiguous; non-anime song stays song-only; OST candidates are labeled correctly. | 2–3 days |
| 4 — personal usability | Result card/artwork/links, history, corrections, manual text lookup, settings, clear/export/import, keyboard and readable status. | Complete daily-use journey; restart preserves chosen settings/history and honors token retention mode. | 1–2 days |
| 5 — verification and packaging | Production build, typecheck, lint, meaningful tests, actual Edge/Chrome runs, instructions, error review. | Passing checks, browser evidence, unpacked build and installation guide. | 1–2 days |

Planning range: roughly 7–13 developer working days, with contingency around API availability and OST coverage. A clean opening/ending-only vertical slice can appear sooner. These are effort estimates, not a promised delivery date. Account setup and provider outages are separate elapsed-time dependencies.

Critical path: verified ongoing-free access and valid provider credential -> real tab capture/encoding -> recognized song -> live song-to-anime association -> useful result -> browser lifecycle verification -> installable delivery.

If the OST spike cannot find defensible metadata, ship the explicit song-only/manual-correction behavior and document measured OST limits; do not fabricate associations or present an unverified fallback as reliable. If AnimeThemes song lookup fails, diagnose the official schema/search mechanism before switching to a bulk catalog mirror.

## 10. Acceptance and evaluation

Automated behavioral checks should cover title collisions, artist disagreement, aliases, Unicode, TV-size/cover/remix distinctions, multiple seasons, missing IDs, invalid schemas, malicious links, cancellation, stale jobs, recognition retry suppression, pending provider jobs, polling limits, and exhausted free allowances. Validate provider-specific no-match/error conventions rather than treating every HTTP success as a recognized song. Provider-boundary tests use sanitized fixtures; fixture success does not replace live API verification.

Manual release checks:

1. Install generated build in Edge using Developer mode -> Load unpacked; identify a known theme from a normal video tab.
2. Show correct song/artist and supported anime association with source link; partial results survive metadata outage.
3. Repeat on an ordinary live stream and a local browser-played audio/video file if permitted by the browser. Record site-specific capture restrictions.
4. Close popup, change active tab, reopen popup: job still targets original tab; capture never silently changes tabs.
5. Cancel and close the source tab; confirm capture indicator stops and subsequent jobs work.
6. Restart browser: remembered settings/history behave as configured; session-only token requires re-entry.
7. Test silence, non-anime music, noisy dialogue, duplicate titles, unavailable APIs, and protected media. A failure message must accurately identify the failed stage.
8. Verify keyboard access, focus, status announcements, long Japanese titles, and absent artwork.
9. Repeat core checks in Chrome; label it supported only after passing.
10. Inspect build, exports, and console output for accidental credentials/audio and unnecessary permissions.

Benchmark a small representative set before declaring accuracy: proposed 10 openings, 10 endings, 5 background OSTs, 5 difficult clips (covers, dialogue, speed changes), and 5 non-anime controls. Capture expected answers and test dates. Keep legally obtained test samples private or use ephemeral live-tab tests; do not commit copyrighted audio.

Report separately: song recognition rate; correct anime association conditional on correct song; overall correct end-to-end result; false anime assignments; median/p95 elapsed time. Initial acceptance requires known supported fixtures to pass and no false certain association in ambiguity tests. Set real-world coverage goals from measured results instead of promising a catalog-wide percentage.

Performance targets, subject to the AudioTag spike: responsive UI; initially about 15 seconds of capture; aim for a result within 45 seconds on a healthy connection; initial total-job ceiling of 90 seconds, then a useful pending/timeout message. Measure and revise these proposed budgets if the free API queues work more slowly. No idle recording or polling; no retained audio after job cleanup. Service latency is external and cannot be guaranteed.

## 11. Delivery and local setup

Deliverables:

- Full source with reproducible dependency lockfile and build commands.
- Built `dist/` folder containing manifest and bundled assets, ready for Load unpacked.
- Installation guide, privacy/data-flow explanation, settings guide, and troubleshooting.
- Sanitized verification report including live tests, measured coverage, known restrictions, and provider limits.
- Example override format, export/import support, and a clear update process (rebuild and Reload extension).

User setup at delivery:

1. Create a personal AudioTag account, confirm the applicable free allowance and obtain its required API credential. Enter it in extension settings; do not commit it or paste it into planning documents. No paid subscription is part of the default setup. If AudioTag cannot meet the free-use requirement, document and evaluate the fallback before changing setup instructions.
2. Open `edge://extensions`, enable Developer mode, choose Load unpacked, and select `dist/` (the directory containing manifest.json).
3. Pin the extension, complete the first-run explanation/settings, and run an explicit test recognition.
4. Keep the extension directory at a stable location. To update, replace/rebuild its files and reload it from the extensions page.

No store review or hosting is required for this installation method. See [Microsoft's local installation guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading).

## 12. Budget and decisions still dependent on evidence

Target recurring cost: US$0 in recognition fees and no hosting, within the selected provider's verified free limits. This target is conditional until AudioTag account limits are checked; a free website is not proof of unlimited free automated API access. At 20 identifications/day, planned use is about 600 identifications per 30 days before retries/testing; actual API operation counts may be higher if polling consumes credits. Set the default quota from the verified allowance rather than assuming this volume is free. The API account is authoritative for usage and billing. Do not purchase credits, activate a paid plan, or silently fall back to paid recognition.

Proceeding implementation defaults: Edge first; TypeScript/Vite; AudioTag adapter after free-access verification; AnimeThemes + AniList; MusicBrainz as a bounded evidence-based fallback; session credential with optional device persistence; one explicit 15-second sample initially; manual retry; local history. RapidAPI third-party Shazam is an evaluated fallback candidate, not an automatically enabled provider.

Evidence-dependent decisions: AudioTag's ongoing free API allowance and automated-use conditions; recognition accuracy/latency on your clips; upload encoding and asynchronous protocol; fallback free-plan eligibility if needed; exact AnimeThemes search/includes; viable OST relationships; optional metadata fallback endpoints. Resolve these early and document the result. Personal setup requires a valid credential for the selected free provider; no credential is needed to start writing and testing the extension shell. If neither candidate provides suitable ongoing-free access, report that limitation rather than describing a trial or unofficial endpoint as guaranteed free service.
