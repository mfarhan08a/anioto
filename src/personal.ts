import type { AnimeMatch, Song } from './contracts';
export type PersonalMatch = { song: Song; anime: AnimeMatch };
export const identity = (song: Song) => `${song.title.normalize('NFKC').trim().toLowerCase()}\n${song.artist.normalize('NFKC').trim().toLowerCase()}`;
export function safeUrl(value: string): string | undefined { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } }
export function parsePersonal(value: unknown): PersonalMatch[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Expected at most 500 personal matches.');
  return value.map((item: unknown) => {
    const x = item as PersonalMatch;
    if (!x || typeof x.song?.title !== 'string' || typeof x.song?.artist !== 'string' || typeof x.anime?.title !== 'string' || typeof x.anime?.sourceUrl !== 'string' || !safeUrl(x.anime.sourceUrl) || [x.song.title,x.song.artist,x.anime.title].some(s=>!s.trim()||s.length>200)) throw new Error('Invalid personal match.');
    return {song:{title:x.song.title.trim(),artist:x.song.artist.trim()},anime:{id:0,title:x.anime.title.trim(),sourceUrl:safeUrl(x.anime.sourceUrl)!,evidence:'Your saved match'}};
  });
}
