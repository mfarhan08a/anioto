# On-demand helper startup

Accepted requirement: opening Otone after reboot starts the local recognition helper as needed. No Windows logon/startup/task entry and no browser-startup launch. The helper can remain available for subsequent requests in that Windows session.

Implementation: popup `ENSURE_HELPER` message → background checks selected provider → bounded localhost health probe → Chromium Native Messaging host if unavailable. Identify repeats the readiness check to recover from a stopped helper. A single shared in-flight promise prevents duplicate launches. AudioTag/manual/diagnostic requests do not launch the local helper.

The one-command native host accepts only `ensureHelper`, validates a bounded length-prefixed JSON message and exact installed extension origin, and starts only the fixed project Python/helper files. It cannot execute extension-provided commands, paths, or URLs. Current-user Edge/Chrome native-host registration points to a local compiled C# stdio launcher; Python owns validation and the existing helper allowlist. No credentials or audio cross the native channel.

Host files and local registration are machine-specific and kept under ignored local-data / HKCU. Installation/removal scripts avoid modifying another application's registration. NativeMessaging and fixed-loopback host permissions are added only to Chromium builds. Portable builds keep their limited permissions and flows.

Validation order: protocol/origin/readiness/deduplication regression tests, compile/register host, full extension build/types/lint/tests, direct real framed native process cold start and healthy reuse, native Edge popup-open launch if automation allows. A simulated stopped-helper test verifies restart behavior without rebooting the user's device. Do not claim an actual reboot test unless one was performed.
