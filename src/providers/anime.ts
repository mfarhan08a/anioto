import type { AnimeMatch, Song } from '../contracts';
import { resolveAnisongDB, type AnisongMatch } from './anisongdb';
import { resolveAnime as resolveAnimeThemes, clearAnimeCache as clearThemesCache, enrich } from './animethemes';
import { canonicalTitleFor } from './title-aliases';
import { canonicalArtist } from './artist-aliases';
import { normalizeSongText } from './song-titles';
import { resolveSupplemental } from './supplemental-songs';
import { recordingReference } from './recording-references';

const CACHE_MS = 3_600_000;
const cache = new Map<string, { expires: number; matches: AnimeMatch[] }>();
export function clearAnimeCache(): void { cache.clear(); clearThemesCache(); }
const aborted = () => new DOMException('Aborted', 'AbortError');

/** Bound optional metadata and the fallback, including requests that ignore abort. */
async function within<T>(run: (signal: AbortSignal) => Promise<T>, ms: number, parent: AbortSignal | undefined, message: string): Promise<T> {
  if (parent?.aborted) throw aborted();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop!: () => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    stop = () => { controller.abort(); reject(aborted()); };
    timer = setTimeout(() => { controller.abort(); reject(new Error(message)); }, ms);
    parent?.addEventListener('abort', stop, { once: true });
  });
  try { return await Promise.race([run(controller.signal), deadline]); }
  finally {
    if (timer) clearTimeout(timer);
    parent?.removeEventListener('abort', stop);
    controller.abort();
  }
}

/** Fast reverse song lookup; only consult AnimeThemes when the primary has no candidates. */
export async function resolveAnime(song: Song, signal?: AbortSignal, onMatches?: (matches: AnimeMatch[]) => void | Promise<void>): Promise<AnimeMatch[]> {
  if (signal?.aborted) throw aborted();
  if (!song.title.trim() || !song.artist.trim()) return [];
  const key = `${normalizeSongText(canonicalTitleFor(song.title, song.artist))}\u0000${canonicalArtist(song.artist)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.matches);
  cache.delete(key);
  const supplemental = resolveSupplemental(song);
  if (supplemental.some(match => match.matchKind !== 'possible')) return supplemental;
  let primaryError: unknown;
  let primary: AnisongMatch[] = [];
  try { primary = await resolveAnisongDB(song, signal); }
  catch (error) {
    if (signal?.aborted) throw aborted();
    primaryError = error;
  }
  if (signal?.aborted) throw aborted();
  if (!primary.some(match => match.matchKind !== 'possible')) {
    const bundledFallback = resolveSupplemental(song, 'fallback');
    if (bundledFallback.length) return bundledFallback;
  }
  let matches: AnimeMatch[];
  if (primary.length) {
    const reference = recordingReference(song);
    if (reference) primary.sort((a, b) => Number(b.anilistId === reference.anilistId) - Number(a.anilistId === reference.anilistId));
    const items = primary.map(({ anilistId, hasEnglishTitle, ...match }) => ({
      anilistId, hasEnglishTitle,
      match: reference && reference.anilistId === anilistId
        ? { ...match, evidence: `${match.evidence} ${reference.evidence}`, recordingReferenceUrl: reference.url } : match,
    }));
    matches = items.map(item => item.match);
    await onMatches?.(structuredClone(matches));
    if (signal?.aborted) throw aborted();
    try {
      await within(async child => {
        await Promise.all(items.slice(0, 3).map(async ({ anilistId, hasEnglishTitle, match }) => {
          if (!anilistId) return;
          try {
            const extra = await enrich(String(anilistId), child);
            if (child.aborted) return;
            const title = extra.title ?? (hasEnglishTitle ? match.title : extra.romajiTitle ?? match.title);
            Object.assign(match, extra, { title });
          } catch { /* Source credits remain useful without artwork. */ }
        }));
      }, 1_500, signal, 'Optional artwork timed out.');
    } catch { if (signal?.aborted) throw aborted(); }
  } else {
    let published: AnimeMatch[] = [];
    try {
      matches = await within(child => resolveAnimeThemes(song, child, value => {
        if (!child.aborted) { published = structuredClone(value); return onMatches?.(value); }
      }), 5_000, signal, 'AnimeThemes fallback timed out.');
    } catch (error) {
      if (signal?.aborted) throw aborted();
      if (published.length) matches = published;
      else {
        if (supplemental.length) return supplemental;
        const fallbackMessage = error instanceof Error ? error.message : 'AnimeThemes fallback is unavailable.';
        if (!primaryError) throw new Error(fallbackMessage);
        const primaryMessage = primaryError instanceof Error ? primaryError.message : 'AnisongDB is unavailable.';
        throw new Error(`${primaryMessage} ${fallbackMessage}`);
      }
    }
    if (!matches.length && primaryError) throw new Error('AnisongDB is unavailable; the AnimeThemes fallback found no connection.');
    if (!matches.length) matches = supplemental;
  }
  if (signal?.aborted) throw aborted();
  if (matches.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + CACHE_MS, matches: structuredClone(matches) });
  }
  return matches;
}
