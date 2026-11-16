import type { AnimeMatch, Song } from '../contracts';
import { canonicalArtistForTitle, canonicalBaseTitleFor, canonicalTitleFor } from './title-aliases';
import { normalizeSongText } from './song-titles';

const API = 'https://anisongdb.com/api/search_request';
const HOMEPAGE = 'https://anisongdb.com/';
const TIMEOUT_MS = 4_000;
type Json = Record<string, unknown>;

/** AniList ID is carried internally so the caller can enrich without another lookup. */
export interface AnisongMatch extends AnimeMatch {
  anilistId?: number;
  hasEnglishTitle?: boolean;
}

const record = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function linkedId(candidate: Json, key: 'anilist' | 'myanimelist'): number | undefined {
  const links = record(candidate.linked_ids) ? candidate.linked_ids : undefined;
  const value = links?.[key];
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function candidateArtists(candidate: Json): string[] {
  const names = new Set<string>();
  if (typeof candidate.songArtist === 'string' && candidate.songArtist.trim()) names.add(candidate.songArtist.trim());
  if (Array.isArray(candidate.artists)) {
    for (const artist of candidate.artists) {
      if (!record(artist)) continue;
      if (typeof artist.name === 'string' && artist.name.trim()) names.add(artist.name.trim());
      if (Array.isArray(artist.names)) {
        for (const name of artist.names) if (typeof name === 'string' && name.trim()) names.add(name.trim());
      } else if (typeof artist.names === 'string' && artist.names.trim()) names.add(artist.names.trim());
    }
  }
  return [...names];
}

function classify(candidate: Json, song: Song, exactTitle: string, baseTitle: string | undefined, ignoreSpacing: boolean): 'confirmed' | 'version' | 'possible' | undefined {
  if (typeof candidate.songName !== 'string' || !candidate.songName.trim()) return undefined;
  const normalize = (value: string) => {
    const normalized = normalizeSongText(value);
    return ignoreSpacing ? normalized.replaceAll(' ', '') : normalized;
  };
  const title = normalize(canonicalTitleFor(candidate.songName, song.artist));
  const expected = normalize(exactTitle);
  const base = baseTitle ? normalize(baseTitle) : undefined;
  if (!title || (title !== expected && title !== base)) return undefined;
  const creditTitle = baseTitle !== undefined && title === base ? baseTitle : exactTitle;
  const artistKey = canonicalArtistForTitle(creditTitle, song.artist);
  const artistMatch = candidateArtists(candidate).some(name => canonicalArtistForTitle(creditTitle, name) === artistKey);
  if (artistMatch) return base && base !== expected && title === base ? 'version' : 'confirmed';
  return ignoreSpacing ? undefined : 'possible';
}

function animeName(candidate: Json): string | undefined {
  for (const key of ['animeENName', 'animeJPName', 'animeAltName']) {
    const value = candidate[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

async function request(body: Json, signal: AbortSignal): Promise<unknown[]> {
  const response = await fetch(API, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`AnisongDB is unavailable (HTTP ${response.status}).`);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('AnisongDB returned an invalid response.'); }
  if (!Array.isArray(payload) || payload.some(item => !record(item))) throw new Error('AnisongDB returned an invalid response.');
  return payload;
}

function searchResults(candidates: unknown[], song: Song, exactTitle: string, baseTitle: string | undefined, ignoreSpacing = false): AnisongMatch[] {
  const rank = { possible: 1, version: 2, confirmed: 3 } as const;
  const matches = new Map<number, AnisongMatch>();
  for (const item of candidates) {
    if (!record(item)) continue;
    const matchKind = classify(item, song, exactTitle, baseTitle, ignoreSpacing);
    const title = typeof item.songName === 'string' ? item.songName.trim() : undefined;
    const artists = candidateArtists(item);
    const anime = animeName(item);
    const japaneseTitle = typeof item.animeJPName === 'string' ? item.animeJPName.trim() : '';
    // This catalog field can contain a romanized title or the original script.
    const romajiTitle = /\p{Script=Latin}/u.test(japaneseTitle) && !/[^\p{Script=Latin}\p{M}\p{Zs}\p{N}\p{P}\p{S}]/u.test(japaneseTitle)
      ? japaneseTitle : undefined;
    const anilistId = linkedId(item, 'anilist');
    const malId = linkedId(item, 'myanimelist');
    const id = anilistId ?? (malId ? -malId : undefined);
    if (!matchKind || !title || !anime || !id) continue;
    const evidence = matchKind === 'confirmed'
      ? `AnisongDB lists “${title}” by ${artists.join(', ')} for ${anime}.`
      : matchKind === 'version'
        ? `AnisongDB lists a version of “${baseTitle}” by ${song.artist} for ${anime}.`
        : `AnisongDB lists “${title}” by ${artists.join(', ') || 'an unverified artist'} for ${anime}; the performer ${song.artist} is not confirmed.`;
    const next: AnisongMatch = {
      id, title: anime, sourceUrl: HOMEPAGE, evidence, matchKind,
      ...(romajiTitle ? { romajiTitle } : {}),
      ...(typeof item.animeENName === 'string' && item.animeENName.trim() ? { hasEnglishTitle: true } : {}),
      ...(typeof item.songType === 'string' && item.songType.trim() ? { type: item.songType.trim() } : {}),
      ...(anilistId ? { anilistId } : {}),
    };
    const previous = matches.get(id);
    if (!previous || rank[matchKind] > rank[previous.matchKind ?? 'possible']) matches.set(id, next);
  }
  const values = [...matches.values()];
  const hasConfirmed = values.some(match => match.matchKind !== 'possible');
  if (ignoreSpacing && values.length !== 1) return [];
  return values.filter(match => !hasConfirmed || match.matchKind !== 'possible')
    .sort((a, b) => rank[b.matchKind ?? 'possible'] - rank[a.matchKind ?? 'possible'])
    .slice(0, 10);
}

/** Resolve AnisongDB credits using both the title and performer. */
export async function resolveAnisongDB(song: Song, signal?: AbortSignal): Promise<AnisongMatch[]> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const exactTitle = canonicalTitleFor(song.title, song.artist);
  const baseTitle = canonicalBaseTitleFor(song.title, song.artist);
  if (!normalizeSongText(exactTitle) || !normalizeSongText(song.artist)) return [];

  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  signal?.addEventListener('abort', relayAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout!: (error: Error) => void;
  const timeout = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
  let rejectCallerAbort!: (error: DOMException) => void;
  const callerAbort = new Promise<never>((_resolve, reject) => { rejectCallerAbort = reject; });
  const abortCaller = () => rejectCallerAbort(new DOMException('Aborted', 'AbortError'));
  signal?.addEventListener('abort', abortCaller, { once: true });
  try {
    timer = setTimeout(() => { controller.abort(); rejectTimeout(new Error('AnisongDB request timed out.')); }, TIMEOUT_MS);
    const work = async (): Promise<AnisongMatch[]> => {
      const titleSearch = await request({
        song_name_search_filter: { search: baseTitle ?? exactTitle, partial_match: false, match_case: false },
        ignore_duplicate: true,
      }, controller.signal);
      const primary = searchResults(titleSearch, song, exactTitle, baseTitle);
      if (primary.some(match => match.matchKind !== 'possible')) return primary;

      // Artist discovery can recover a title with joined or separated words.
      // Only use a spacing-insensitive match when its credit is unambiguous.
      try {
        const discovery = await request({
          artist_search_filter: { search: song.artist, partial_match: false, match_case: false },
          ignore_duplicate: true,
        }, controller.signal);
        const candidates = [...titleSearch, ...discovery];
        const exact = searchResults(candidates, song, exactTitle, baseTitle);
        if (exact.some(match => match.matchKind !== 'possible')) return exact;
        const spacingMatch = searchResults(candidates, song, exactTitle, baseTitle, true);
        return spacingMatch.length ? spacingMatch : exact;
      } catch (error) {
        if (controller.signal.aborted || signal?.aborted) throw error;
        if (primary.length) return primary;
        throw error;
      }
    };
    return await Promise.race([work(), timeout, callerAbort]);
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new Error('AnisongDB request timed out.');
    if (error instanceof Error && error.message.startsWith('AnisongDB ')) throw error;
    throw new Error('AnisongDB is unavailable.');
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener('abort', relayAbort);
    signal?.removeEventListener('abort', abortCaller);
  }
}
