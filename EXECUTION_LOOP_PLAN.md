# Delegated execution loop

Prepared 1 November 2026. Planning only: no implementation loop or subagents started.

## Objective and scope

Deliver the personal-use Edge extension described in IMPLEMENTATION_PLAN.md, with a reproducible build, useful song/anime results, explicit failures, and install instructions. AudioTag is the first free recognition candidate, not a verified unlimited-free service. No paid fallback or GitHub publication is part of this execution.

## Team and model allocation

- Coordinator: existing main agent. Own contracts, task boundaries, shared configuration, integration, difficult browser lifecycle defects, verification decisions, and user updates.
- Worker: explicitly request `gpt-6-luna` with medium reasoning and a fresh, compact context for bounded implementation tasks.
- Reviewer: explicitly request `gpt-6-luna` with medium reasoning, independently check the affected behavior and tests. Read-only by default; return actionable findings, not rewrites.
- Normally one worker at a time. Use at most two workers in parallel when file ownership and dependencies are independent. The reviewer normally runs after implementation, not concurrently against changing files.
- No recursive agent delegation. Do not let workers create more agents. If the requested cheaper model is unavailable, report it rather than silently launching another expensive worker.

Luna is available in this session as the lower-cost option for lighter work. This is a model-selection policy, not a promise of exact prices or total savings. No additional OpenAI API key or application-side AI service is required merely to use the session's subagents.

## Loop algorithm

1. Read the small progress ledger and select the next unblocked milestone.
2. Coordinator defines a bounded task: owned paths, exact interfaces, acceptance checks, and exclusions. Shared contracts/configuration are edited by the coordinator or a single named owner.
3. Delegate only the necessary context: task description, relevant file paths, governing instructions, and provider facts. Use fresh contexts instead of copying the entire chat.
4. Worker implements and runs targeted checks. Response contains changed files, concise behavior summary, checks/results, and unresolved blockers. No large file dumps.
5. Coordinator reviews the diff, integrates, and runs required build/type/lint checks plus relevant tests. Stop at the first failed gate and fix the actual failure.
6. Reviewer checks milestone behavior, important negative cases, and meaningful test coverage. Do not commission a second review that repeats the same scope without new evidence.
7. Return a concrete failing case to the same worker for correction. Allow at most two repair attempts for the same unresolved failure before coordinator diagnosis; do not endlessly resubmit an unchanged task. Coordinator may resolve a newly understood defect directly.
8. Record evidence and remaining work in docs/PROGRESS.md during execution. Advance only on passing checks, or mark an external dependency explicitly while progressing independent work.
9. Stop when deliverables are verified, a real external dependency prevents further useful work, or the user stops the run. Never call mocked success a live integration pass.

## Dependency-ordered milestones

| Milestone | Owner split | Completion check |
|---|---|---|
| A. Provider feasibility and contracts | Coordinator verifies AudioTag protocol/free-use facts and defines job/provider contracts; a Luna worker can inspect public metadata schemas | Document verified facts versus unknowns; small adapter contracts ready; no paid service activated |
| B. Extension foundation | Coordinator owns manifest/build/contracts; Luna owns bounded popup/settings or storage modules | Reproducible build, typed messages, settings and local state work using explicit development fixtures |
| C. Capture and recognition | Coordinator owns offscreen lifecycle integration; Luna implements AudioTag adapter against verified protocol | Real tab capture, playback, cancel, no duplicate submission; live recognition requires personal provider access |
| D. Anime resolver | Luna owns normalization, AnimeThemes/AniList adapters and matching tests | Known theme associations resolve; artist/title collisions stay ambiguous; source evidence retained |
| E. Usability and robustness | Luna handles bounded history/manual override UI; coordinator integrates jobs and errors | Popup reopen, history, manual search, free-quota limits, timeout and partial results behave correctly |
| F. Release verification | Coordinator runs final checks; independent Luna reviews behavior/security of final diff | Build/type/lint/tests pass, real Edge evidence, documented Chrome status, usable dist folder and instructions |

OST fallback follows evidence from the provider/metadata spike. Unknown associations produce song-only results; do not spend repeated agent cycles inventing a full soundtrack catalog.

## Token-efficiency controls

- Prefer direct coordinator edits for trivial work; delegation overhead can exceed the work itself.
- Reuse completed research and local files. Fetch documentation only for unresolved integration details.
- Assign narrow tasks with explicit file ownership. Do not have multiple agents explore the whole repository independently.
- Return short summaries and relevant failure output; keep generated artifacts on disk.
- Run targeted checks during development and one final comprehensive verification; repeat only after relevant changes or unresolved failures.
- Do not busy-poll agents or rerun unchanged tests. Continue independent coordinator work while they run.
- No maximum reasoning by default, speculative features, redundant reviewers, or background monitoring agents.
- No numerical total token budget has been requested. If the user supplies one later, treat it as a stopping constraint, not an estimate of guaranteed completion. Report only usage actually available from tooling; do not fabricate per-agent dollar totals.

## Prerequisites and external dependencies

Already present: local Git repository; MIT license; project/implementation plan; Node v20.15.0, npm 10.7.0, Git 2.33.0. Match the chosen toolchain's supported Node versions during setup; update Node or pin a maintained compatible toolchain if required. No package install/build check has run yet.

Before scaffolding: no personal credential is necessary. Need available dependency download access and working toolchain, checked during setup. Existing user direction establishes Edge-first, personal-use, open-source, and free-provider scope.

Before credentialed recognition verification: a personal AudioTag account, current free API entitlement, and its credential. Prefer entering credentials directly into the extension settings once available. Never ask for them in public issues or commit them. Public research can proceed without account access; account-only quota facts must remain unknown until inspected.

If free entitlement fails: evaluate the documented RapidAPI candidate's recognition endpoint, account requirements, and any potential fees. Do not subscribe or introduce a card-backed service automatically. Continue useful local implementation, but report the live-recognition dependency clearly.

Before the final browser pass: a supported Edge installation and a suitable playable test tab. Use temporary browser audio samples; retain sanitized observations rather than committing copyrighted audio. Some browser permission/installation interactions may need user action if automation cannot complete them.

No GitHub account, remote URL, deployment server, billing card, additional OpenAI API key, or ongoing recognition subscription is required to start local implementation. Git identity is only needed before commits; a remote and publication choices are only needed when the user asks to publish.

## Reporting and completion

During execution, provide concise milestone updates explaining passing behavior, concrete failures, and external blockers. On completion, provide source/build paths, installation steps, checks passed, actual live-test status, and known limits. If provider access is missing, deliver the verified local portions and explicitly state that end-to-end recognition is not ready; retain the outstanding task instead of marking the whole product complete.
