import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeSongText } from '../src/providers/song-titles';
import { resolveAnisongDB } from '../src/providers/anisongdb';
import { samePerformers, scriptKey } from '../src/providers/credit-matching';

const row = (songName: string, songArtist: string, id = 1, extra = {}) => ({
  songName, songArtist, animeENName: `Anime ${id}`, linked_ids: { anilist: id }, ...extra,
});
const response = (data: unknown) => new Response(JSON.stringify(data));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('shared credit discovery', () => {
  it('preserves Japanese voicing while normalizing width and Latin accents', () => {
    expect(normalizeSongText('ガールズ')).toBe('ガールズ');
    expect(normalizeSongText('ガ')).not.toBe(normalizeSongText('カ'));
    expect(normalizeSongText('ｶﾞ')).toBe(normalizeSongText('ガ'));
    expect(normalizeSongText('fhána')).toBe('fhana');
  });

  it('compares kana and romaji without translating or reading kanji', () => {
    expect(scriptKey('ひかり☆の☆うた')).toBe(scriptKey('Hikari no Uta'));
    expect(scriptKey('らぶりぃでびる')).not.toBe(scriptKey('Lovely Devil'));
    expect(scriptKey('夢')).not.toBe(scriptKey('Yume'));
  });

  it('compares complete CV lineups regardless of order without adding the group prefix', () => {
    const credit = 'The Cast Alice(CV: Singer One), Bob(CV. Singer Two)';
    expect(samePerformers(credit, [['Singer Two'], ['Singer One']])).toBe(true);
    expect(samePerformers('Singer One', [['Singer Two'], ['Singer One']])).toBe(false);
    expect(samePerformers(`${credit} & Carol(CV: Singer Three)`, [['Singer Two'], ['Singer One']])).toBe(false);
    expect(samePerformers(`${credit} & Uncredited Guest`, [['Singer Two'], ['Singer One']])).toBe(false);
  });

  it('discovers a previously unseen kana title from live-shaped romanized credits', async () => {
    const requests = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return response(body.song_name_search_filter?.partial_match
        ? [row('Hikari no Uta', 'New Singer')] : []);
    });
    vi.stubGlobal('fetch', requests);
    await expect(resolveAnisongDB({ title: 'ひかりのうた', artist: 'New Singer' }))
      .resolves.toMatchObject([{ id: 1, matchKind: 'confirmed' }]);
    expect(requests.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('recovers punctuation mismatches but rejects partial-title collisions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return response(body.song_name_search_filter?.partial_match
        ? [row('Starlight☆Parade!', 'New Singer'), row('Starlight Parade Forever', 'New Singer', 2)] : []);
    }));
    await expect(resolveAnisongDB({ title: 'Starlight Parade', artist: 'New Singer' }))
      .resolves.toMatchObject([{ id: 1, matchKind: 'confirmed' }]);
  });

  it('does not lose title recovery when artist discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.artist_search_filter) return new Response('', { status: 503 });
      return response(body.song_name_search_filter?.partial_match ? [row('Hikari no Uta', 'New Singer')] : []);
    }));
    await expect(resolveAnisongDB({ title: 'ひかりのうた', artist: 'New Singer' })).resolves.toMatchObject([{ matchKind: 'confirmed' }]);
  });

  it('reports failed discovery as unavailable instead of a definitive empty result', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return body.song_name_search_filter?.partial_match === false ? response([]) : new Response('', { status: 503 });
    }));
    await expect(resolveAnisongDB({ title: 'ひかりのうた', artist: 'New Singer' })).rejects.toThrow('HTTP 503');
  });

  it('verifies the entire source group membership rather than any single member', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([row('New Theme', 'New Unit', 1, {
      artists: [{ names: ['New Unit'], members: [{ names: ['Singer One'] }, { names: ['Singer Two'] }] }],
    })])));
    await expect(resolveAnisongDB({ title: 'New Theme', artist: 'Singer Two & Singer One' }))
      .resolves.toMatchObject([{ matchKind: 'confirmed' }]);
    await expect(resolveAnisongDB({ title: 'New Theme', artist: 'Singer One' }))
      .resolves.toMatchObject([{ matchKind: 'possible' }]);
  });

  it('does not confirm a solo member from a catalog credit containing multiple individual artists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([row('New Theme', 'Singer One & Singer Two', 1, {
      artists: [{ names: ['Singer One'] }, { names: ['Singer Two'] }],
    })])));
    await expect(resolveAnisongDB({ title: 'New Theme', artist: 'Singer One' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
    await expect(resolveAnisongDB({ title: 'New Theme', artist: 'Singer Two & Singer One' })).resolves.toMatchObject([{ matchKind: 'confirmed' }]);
  });

  it('requests every anime association and deduplicates locally by anime ID', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return response(body.ignore_duplicate ? [row('Theme', 'Singer')] : [
        row('Theme', 'Singer'), row('Theme', 'Singer', 2), row('Theme', 'Singer', 2),
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await resolveAnisongDB({ title: 'Theme', artist: 'Singer' })).map(match => match.id)).toEqual([1, 2]);
  });

  it('keeps multiple anime for the same phonetic credit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([
      row('Hikari no Uta', 'New Singer'), row('Hikari no Uta', 'New Singer', 2),
    ])));
    expect((await resolveAnisongDB({ title: 'ひかりのうた', artist: 'New Singer' })).map(match => match.id)).toEqual([1, 2]);
  });

  it('never fabricates translated titles for the two new screenshot cases', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([
      row('Akihabara☆Dance☆Now!!', 'Ayana Taketatsu, Kana Hanazawa, Hitomi Nabatame'),
      row('Lovely♥Devil', 'Occult Kenkyuu-bu Girls', 2),
    ])));
    await expect(resolveAnisongDB({ title: 'アキハバラ☆だんす☆なう!!', artist: 'Oreno Imoutoga Konnani Kawaii Wakeganai' })).resolves.toEqual([]);
    await expect(resolveAnisongDB({ title: 'らぶりぃでびる', artist: 'オカルト研究部ガールズ' })).resolves.toEqual([]);
  });
});
