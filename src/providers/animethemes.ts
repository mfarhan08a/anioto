import type { AnimeMatch, Song } from '../contracts';
import { canonicalBaseTitleFor, canonicalTitleFor } from './title-aliases';
import { normalizeSongText as norm } from './song-titles';
import { resolveSupplemental } from './supplemental-songs';
import { canonicalArtist } from './artist-aliases';
import { recordingReference } from './recording-references';

const API = 'https://api.animethemes.moe/song';
const ANILIST = 'https://graphql.anilist.co';
const TIMEOUT_MS = 25_000;
const ENRICHMENT_MS = 1_500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { expires: number; matches: AnimeMatch[] }>();

/** Invalidate the bounded in-memory metadata cache (also useful to force a fresh verification). */
export function clearAnimeCache(): void { cache.clear(); }

function remember(key: string, matches: AnimeMatch[]): AnimeMatch[] {
  if (matches.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, matches: structuredClone(matches) });
  }
  return matches;
}
type Json = Record<string, unknown>;
const record = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function versionAwareMatch(candidate: Json, title: string, artist: string, baseTitle: string | undefined): 'confirmed' | 'version' | 'possible' | undefined {
  if (typeof candidate.title !== 'string') return undefined;
  const candidateTitle = norm(candidate.title);
  const artistMatched = animeArtists(candidate).some(name => canonicalArtist(name) === artist);
  if (candidateTitle === title && artistMatched) return 'confirmed';
  if (baseTitle && candidateTitle === baseTitle) return artistMatched ? 'version' : 'possible';
  if (candidateTitle === title) return 'possible';
  return undefined;
}

function animeArtists(song: Json): string[] {
  const artists = new Set<string>();
  if (Array.isArray(song.artists)) {
    for (const artist of song.artists) if (record(artist) && typeof artist.name === 'string') artists.add(artist.name);
  }
  if (Array.isArray(song.performances)) {
    for (const performance of song.performances) {
      if (record(performance) && record(performance.artist) && typeof performance.artist.name === 'string') artists.add(performance.artist.name);
    }
  }
  return [...artists];
}

function resourceId(anime: Json): string | undefined {
  if (!Array.isArray(anime.resources)) return undefined;
  const resource = anime.resources.find(item => record(item) && (
    item.site === 'AniList' || (record(item.site) && item.site.name === 'AniList') ||
    (record(item.resource) && item.resource.name === 'AniList')
  ));
  if (!record(resource)) return undefined;
  return typeof resource.external_id === 'string' || typeof resource.external_id === 'number'
    ? String(resource.external_id) : undefined;
}

export async function enrich(id: string, signal: AbortSignal): Promise<Partial<Pick<AnimeMatch, 'title' | 'romajiTitle' | 'coverUrl'>>> {
  if (!/^\d+$/.test(id)) return {};
  const response = await fetch(ANILIST, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query ($id: Int) { Media(id: $id, type: ANIME) { title { english romaji } coverImage { large } } }', variables: { id: Number(id) } }),
  });
  if (!response.ok) return {};
  const body: unknown = await response.json();
  if (!record(body) || !record(body.data) || !record(body.data.Media)) return {};
  const media = body.data.Media;
  const titles = record(media.title) ? media.title : {};
  const english = typeof titles.english === 'string' ? titles.english.trim() : undefined;
  const romajiTitle = typeof titles.romaji === 'string' ? titles.romaji.trim() : undefined;
  const coverUrl = record(media.coverImage) && typeof media.coverImage.large === 'string' ? media.coverImage.large : undefined;
  return { ...(english ? { title: english } : {}), ...(romajiTitle ? { romajiTitle } : {}), ...(coverUrl ? { coverUrl } : {}) };
}

async function fetchAnimeResources(slug: string, signal: AbortSignal): Promise<Json | undefined> {
  const url = new URL(`https://api.animethemes.moe/anime/${encodeURIComponent(slug)}`);
  url.searchParams.set('include', 'resources');
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  return record(body) && record(body.anime) ? body.anime : undefined;
}

/** Resolve a song using AnimeThemes credits; distinguish an unavailable catalog from an empty search. */
export async function resolveAnime(song: Song, signal?: AbortSignal, onMatches?: (matches: AnimeMatch[]) => void | Promise<void>): Promise<AnimeMatch[]> {
  const queryTitle = canonicalTitleFor(song.title, song.artist);
  const title = norm(queryTitle);
  const artist = canonicalArtist(song.artist);
  const baseQueryTitle = canonicalBaseTitleFor(song.title, song.artist);
  const baseTitle = baseQueryTitle ? norm(baseQueryTitle) : undefined;
  if (!title || !artist) return [];
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const key = `${title}\u0000${artist}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.matches);
  cache.delete(key);
  const supplemental = resolveSupplemental(song);
  // Reviewed insert-song evidence works even when the OP/ED service is down.
  if (supplemental.some(match => match.matchKind !== 'possible')) return supplemental;
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  signal?.addEventListener('abort', relayAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // LIKE without wildcards searches the full base title; local artist checks
    // below distinguish verified credits from possible covers.
    const queries = [baseQueryTitle ?? queryTitle];
    const catalogSongs = new Map<string, Json>();
    for (const query of queries) {
      const url = new URL(API);
      url.searchParams.set('filter[title-like]', query);
      url.searchParams.set('include', 'artists,performances.artist,animethemes,animethemes.anime');
      url.searchParams.set('fields[song]', 'id,title');
      url.searchParams.set('fields[anime]', 'id,name,slug');
      url.searchParams.set('fields[artist]', 'id,name');
      url.searchParams.set('page[size]', '30');
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`AnimeThemes is unavailable (HTTP ${response.status}).`);
      let body: unknown;
      try { body = await response.json(); }
      catch { throw new Error('AnimeThemes returned an invalid response.'); }
      if (!record(body) || !Array.isArray(body.songs)) throw new Error('AnimeThemes returned an invalid response.');
      for (const item of body.songs) {
        if (record(item)) catalogSongs.set(String(item.id ?? `${item.title}|${animeArtists(item).join(',')}`), item);
      }
    }
    const rank = { possible: 1, version: 2, confirmed: 3 } as const;
    const found = new Map<number, { anime: Json; type?: string; matchKind: 'confirmed' | 'version' | 'possible'; evidence: string }>();
    for (const candidate of catalogSongs.values()) {
      const matchKind = versionAwareMatch(candidate, title, artist, baseTitle);
      if (!matchKind || !Array.isArray(candidate.animethemes)) continue;
      const sourceArtists = animeArtists(candidate);
      for (const theme of candidate.animethemes) {
        if (!record(theme) || !record(theme.anime) || typeof theme.anime.id !== 'number' || typeof theme.anime.name !== 'string' || typeof theme.anime.slug !== 'string') continue;
        const id = theme.anime.id;
        const sourceCredit = sourceArtists.length ? ` AnimeThemes credits ${sourceArtists.join(', ')}.` : '';
        const evidence = matchKind === 'confirmed'
          ? `AnimeThemes song credit matches “${song.title}” by ${song.artist}.`
          : matchKind === 'version'
            ? `AnimeThemes credits a recording of “${baseQueryTitle}” to ${song.artist}.${sourceCredit}`
            : `Possible underlying song: AnimeThemes credits “${candidate.title}” to ${sourceArtists.join(', ') || 'an unknown artist'}; the recording performer ${song.artist} is not confirmed.`;
        const previous = found.get(id);
        if (!previous || rank[matchKind] > rank[previous.matchKind]) {
          found.set(id, { anime: theme.anime, ...(typeof theme.type === 'string' ? { type: theme.type } : {}), matchKind, evidence });
        }
      }
    }
    const hasArtistConfirmedMatch = [...found.values()].some(match => match.matchKind !== 'possible');
    const rankedMatches = [...found.values()].filter(match => !hasArtistConfirmedMatch || match.matchKind !== 'possible');
    const reference = recordingReference(song);
    if (reference) rankedMatches.sort((a, b) => Number(b.anime.slug === reference.animeSlug) - Number(a.anime.slug === reference.animeSlug));
    const selected = rankedMatches.slice(0, 10);
    const matches: AnimeMatch[] = selected.map(({ anime, type, matchKind, evidence }) => ({
      id: anime.id as number,
      title: anime.name as string,
      sourceUrl: `https://animethemes.moe/anime/${encodeURIComponent(anime.slug as string)}`,
      ...(type ? { type } : {}), matchKind,
      evidence: reference && reference.animeSlug === anime.slug ? `${evidence} ${reference.evidence}` : evidence,
      ...(reference && reference.animeSlug === anime.slug ? { recordingReferenceUrl: reference.url } : {}),
    }));
    const combined = [...matches, ...supplemental];
    const visible = combined.some(match => match.matchKind !== 'possible')
      ? combined.filter(match => match.matchKind !== 'possible') : combined;
    // The source-backed title is useful immediately; artwork must not hold it up.
    if (visible.length) await onMatches?.(structuredClone(visible));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await enrichInParallel(selected.slice(0, 3).map(({ anime }) => anime), visible, controller.signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return remember(key, visible);
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (supplemental.length) return supplemental;
    if (controller.signal.aborted) throw new Error('AnimeThemes request timed out.');
    if (error instanceof Error && error.message.startsWith('AnimeThemes ')) throw error;
    throw new Error('AnimeThemes is unavailable.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relayAbort);
  }
}


/** Artwork/English titles are optional: at most three concurrent chains, 1.5s total. */
async function enrichInParallel(anime: Json[], matches: AnimeMatch[], parent: AbortSignal): Promise<void> {
  if (!anime.length || parent.aborted) return;
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release!: () => void;
  const deadline = new Promise<void>(resolve => {
    release = resolve;
    timer = setTimeout(() => { controller.abort(); resolve(); }, ENRICHMENT_MS);
  });
  const stopWaiting = () => { controller.abort(); release(); };
  parent.addEventListener('abort', stopWaiting, { once: true });
  try {
    await Promise.race([deadline, Promise.all(anime.map(async item => {
      try {
        const detail = resourceId(item) ? item : await fetchAnimeResources(item.slug as string, controller.signal);
        const id = detail ? resourceId(detail) : undefined;
        const extra = id ? await enrich(id, controller.signal) : {};
        if (controller.signal.aborted) return;
        const match = matches.find(value => value.id === item.id);
        if (match) Object.assign(match, extra, { title: extra.title ?? extra.romajiTitle ?? match.title });
      } catch { /* Keep the already documented title if optional artwork fails. */ }
    })).then(() => undefined)]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    parent.removeEventListener('abort', abort);
    parent.removeEventListener('abort', stopWaiting);
  }
}
