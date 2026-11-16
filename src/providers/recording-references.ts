import type { Song } from '../contracts';
import { normalizeSongText } from './song-titles';

/** Reviewed release references rank candidates; they do not override a fingerprint's performer. */
const REFERENCES = [{
  title: 'Orange (Underwater)',
  artists: ['Kaori Miyazono & Zero Two', 'Zero Two & Kaori Miyazono'],
  animeSlug: 'shigatsu_wa_kimi_no_uso',
  anilistId: 20665,
  url: 'https://open.spotify.com/track/50kfguKW1syfBC7YslSvfu',
  // Spotify lists this recording on "Orange (from: Shigatsu wa Kimi no Uso)".
  evidence: 'The listed release names Shigatsu wa Kimi no Uso; this supports the anime candidate, not an original-performer match.',
}] as const;

export function recordingReference(song: Song): typeof REFERENCES[number] | undefined {
  return REFERENCES.find(entry => normalizeSongText(entry.title) === normalizeSongText(song.title) &&
    entry.artists.some(artist => normalizeSongText(artist) === normalizeSongText(song.artist)));
}
