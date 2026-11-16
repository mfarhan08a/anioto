import { afterEach, expect, it, vi } from 'vitest';
import { withoutFeaturedCredit, baseRecordingTitle } from '../src/providers/song-titles';
import { canonicalTitleFor } from '../src/providers/title-aliases';
import { resolveAnisongDB } from '../src/providers/anisongdb';

afterEach(() => vi.unstubAllGlobals());
it.each(['Red Swan (feat. HYDE)', 'Red Swan [ft. HYDE]', 'Red Swan featuring HYDE', 'Red Swan（feat. HYDE）'])('ignores trailing featured metadata in %s', input => {
  expect(withoutFeaturedCredit(input)).toBe('Red Swan');
  expect(canonicalTitleFor(input, 'YOSHIKI')).toBe('Red Swan');
  expect(baseRecordingTitle(input)).toBeUndefined(); // Credit alone is not a recording-version marker.
});
it.each(['Featuring You', 'Feat', 'Song (feat.)', 'Song (HYDE)', 'Song (Remix)', 'Defeating You'])('preserves meaningful title text in %s', input => {
  expect(withoutFeaturedCredit(input)).toBe(input);
});
it.each(['Red Swan (feat. HYDE) (Live)', 'Red Swan (Live) (feat. HYDE)'])('handles combined version and credit metadata in %s', input => {
  expect(baseRecordingTitle(input)).toBe('Red Swan');
});
it('scopes the translated Music Train alias to the verified original artist', () => {
  expect(canonicalTitleFor('Music Train', 'Tatsuro Yamashita')).toBe('Uta no Kisha');
  expect(canonicalTitleFor('Music Train', 'Another Artist')).toBe('Music Train');
});
it('matches the reported Red Swan title against actual catalog-shaped artist credits', async () => {
  const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([{
    songName: 'Red Swan', songArtist: 'YOSHIKI feat. HYDE', artists: [{ names: ['HYDE'] }, { names: ['YOSHIKI'] }],
    animeENName: 'Attack on Titan Season 3', linked_ids: { anilist: 99147 }, songType: 'Opening 1',
  }])));
  vi.stubGlobal('fetch', request);
  await expect(resolveAnisongDB({ title: 'Red Swan (feat. HYDE)', artist: 'YOSHIKI' })).resolves.toMatchObject([{ title: 'Attack on Titan Season 3', matchKind: 'confirmed' }]);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe('Red Swan');
});
it('does not turn a different performer into a confirmed Red Swan artist', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{
    songName: 'Red Swan', songArtist: 'YOSHIKI feat. HYDE', artists: [{ names: ['YOSHIKI'] }], animeENName: 'Attack on Titan Season 3', linked_ids: { anilist: 99147 },
  }]))));
  await expect(resolveAnisongDB({ title: 'Red Swan (feat. HYDE)', artist: 'Cover Performer' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
});
