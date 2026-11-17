# Anioto privacy policy

Effective November 18, 2026.

Anioto is an open-source browser extension maintained by [mfarhan08a](https://github.com/mfarhan08a). It identifies songs and finds their documented anime connections. This policy describes the local development builds and the store edition in preparation. The repository’s optional AudD server must be configured and deployed before cloud recognition is available.

## Tab audio and local previews

When you start a scan, Anioto captures a short sample from the active tab. SongRec and Local Shazam use samples of up to twelve seconds. The store edition’s AudD option uses an eight-second sample. Anioto releases its capture resources when processing finishes or you cancel.

The local audio test records a fifteen-second preview. That preview stays in extension memory and expires after two minutes or when a new capture or lookup replaces it. Anioto does not request microphone access.

## Recognition services

### SongRec and Local Shazam

Anioto passes the sample over localhost to a companion running on your device. SongRec or ShazamIO creates a fingerprint locally and queries Shazam’s online catalog. Shazam receives the fingerprint and normal network request information, including the connecting network address. These integrations are unofficial clients of Shazam.

SongRec can create a temporary WAV file while recognizing a sample. The helper removes that file after the recognition worker finishes, including cancellation and error cleanup. The helper stores no recognition history and its request logger is disabled.

### AudD in the store edition

When you select AudD and enable its upload consent, Anioto sends the clip to the configured Anioto HTTPS server, which forwards it to AudD. The server processes the clip in memory. Application code does not save audio, tab URLs, or song results on the server.

The server processes the connecting network address to enforce usage limits. It stores a keyed daily hash derived from that address, a daily usage counter, and a monthly total. Expired quota records are deleted during a subsequent quota reservation. The production service is not deployed as of this policy’s effective date.

AudD processes submitted content under its [API terms](https://audd.io/legal/terms/). Hosting and recognition providers can process network information under their own policies. Anioto does not promise a provider-specific retention period beyond what the provider publishes or agrees with the service operator.

### AudioTag in local development builds

AudioTag receives a fifteen-second audio sample when you select that provider and confirm the upload disclosure. It also receives the API key you supply to authenticate requests. Anioto checks the account’s available free seconds before requesting recognition. AudioTag’s handling of submitted content follows its [service information and terms](https://audiotag.info/faq).

An AudioTag key stays in browser session storage unless you choose to remember it on the device. Remembered keys use browser extension local storage. In the portable file workspace, the key stays in workspace memory.

## Anime metadata and artwork

Anioto sends song title and artist queries to AnisongDB and, when needed, AnimeThemes to find anime song credits. AniList receives anime metadata queries to provide titles and artwork links. Loading an image contacts its image host. These services receive normal network information such as the connecting network address.

Manual song search transmits the title and artist you enter to the relevant metadata services. It does not require an audio sample.

## Settings and recent results

The Edge and Chrome popup builds store your selected provider, upload-consent preference, saved personal matches, and up to one hundred recent results in browser extension storage on the device. Current job state is stored for the browser session so the popup can restore progress. Portable workspaces have a smaller feature set and do not share the popup’s stored history.

You can clear recent results in History, manage personal matches in Settings, revoke AudD upload consent, and remove a saved AudioTag key. Removing the extension removes its browser-managed local storage. The separately installed Windows companion has its own uninstall procedure.

## Purpose and sharing

Anioto uses these data flows to recognize music, retrieve anime credits, display results, and enforce the optional cloud service’s limits. Anioto does not add advertising analytics, sell user data, use data to determine creditworthiness, or use it for lending purposes. External providers’ own data practices are governed by their respective policies.

Anioto’s use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## GitHub support and policy updates

For questions, use [Anioto’s GitHub Issues](https://github.com/mfarhan08a/anioto/issues). Issues are public, so share only information you intend to make public. GitHub processes visits and contributions under its [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Updates to this policy will be committed to this repository with a revised effective date. Deployment of the AudD service will require updating the policy to identify the operator’s hosting and support details.
