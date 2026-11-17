# Anioto store edition privacy notice draft

Complete the publisher contact and confirm the providers’ current retention terms before publishing this notice. This notice describes the Edge and Chrome store build.

- Anioto captures active-tab audio when you start a scan or a local audio test. It does not request microphone access. The audio test stays on your device.
- With SongRec or Local Shazam selected, Anioto passes a short clip to the Windows companion over localhost. The companion creates a fingerprint and queries Shazam. SongRec may temporarily write a WAV file while processing and removes it when recognition finishes or is cancelled.
- With AudD selected and audio uploads enabled, Anioto sends a short audio clip through Anioto’s HTTPS recognition server to AudD. The server forwards the clip in memory and does not save it or send a tab URL. For rate limiting, the server processes the network address and stores a daily derived quota key and counters. An expired key is removed on a subsequent quota reservation. AudD’s handling of submitted content is described in its [API terms](https://audd.io/legal/terms/).
- Anioto sends song and artist metadata to AnisongDB and, where needed, AnimeThemes. AniList provides anime metadata and artwork. Artwork requests also contact the image host. Anioto keeps settings, consent, personal matches, and up to 100 recent results on the device. Clear recent results in History and revoke AudD consent in Settings.
- Anioto’s use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Publisher support contact and effective date must be supplied before publication.
