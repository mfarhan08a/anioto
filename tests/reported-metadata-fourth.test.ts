import { afterEach, expect, it, vi } from 'vitest';
import { resolveAnisongDB } from '../src/providers/anisongdb';
import { canonicalArtistForTitle, canonicalTitleFor } from '../src/providers/title-aliases';
import { baseRecordingTitle } from '../src/providers/song-titles';

afterEach(() => vi.unstubAllGlobals());
const cases = [
  { title: 'Toki Wo Kizamu Uta (TV Animation Ver.)', artist: 'VISUAL ARTS / Key', catalog: 'Toki o Kizamu Uta', credit: 'Lia', anime: 'Clannad: After Story', kind: 'version' },
  { title: 'Chika Dance', artist: 'Gudrap', catalog: 'Chikatto Chika Chika♡', credit: 'Konomi Kohara', anime: 'Kaguya-sama: Love is War', kind: 'possible' },
  { title: 'Love Supreme!', artist: 'Fhána', catalog: 'Ai no Supreme!', credit: 'fhána', anime: "Miss Kobayashi's Dragon Maid S", kind: 'confirmed' },
  { title: 'Destination of the journey', artist: 'Hana Hope', catalog: 'Tabi no Yukue', credit: 'Hana Hope', anime: 'Spice and Wolf: Merchant Meets the Wise Wolf', kind: 'confirmed' },
  { title: '目覚めの唄', artist: 'Yuiko Ohara', catalog: 'Mezame no Uta', credit: 'Yuiko Ohara', anime: 'Mushoku Tensei: Jobless Reincarnation', kind: 'confirmed' },
  { title: 'With love from the closet', artist: 'Hitori Gotoh', catalog: 'Oshiire yori Ai o Komete', credit: 'Yoshino Aoyama', anime: 'Bocchi the Rock!', kind: 'confirmed' },
  { title: '我こそがアインズ・ウール・ゴウン', artist: 'Syuji Katayama', catalog: 'Ware koso ga Ainz Ooal Gown', credit: 'Ainz Ooal Gown Gasshou-dan', anime: 'Overlord', kind: 'confirmed' },
];

it.each(cases)('resolves $title with the appropriate artist confidence', async ({ title, artist, catalog, credit, anime, kind }) => {
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([
    { songName: catalog, songArtist: credit, animeENName: anime, linked_ids: { anilist: 123 } },
  ])));
  vi.stubGlobal('fetch', request);
  await expect(resolveAnisongDB({ title, artist })).resolves.toMatchObject([{ title: anime, matchKind: kind }]);
  expect(request).toHaveBeenCalledTimes(kind === 'possible' ? 2 : 1);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe(catalog);
  expect((await resolveAnisongDB({ title, artist: 'Unknown performer' })).every(match => match.matchKind === 'possible')).toBe(true);
  await expect(resolveAnisongDB({ title: 'Unrelated song', artist })).resolves.toEqual([]);
});

it('uses reviewed nicknames for discovery without granting an artist identity', async () => {
  expect(canonicalTitleFor('Chika Dance', 'A new cover artist')).toBe('Chikatto Chika Chika♡');
  expect(canonicalArtistForTitle('Chikatto Chika Chika♡', 'Gudrap')).not.toBe(canonicalArtistForTitle('Chikatto Chika Chika♡', 'Konomi Kohara'));
  expect(canonicalTitleFor('Comedy', 'A new cover artist')).toBe('Comedy');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { songName: 'Chikatto Chika Chika♡', songArtist: 'Konomi Kohara', animeENName: 'Kaguya-sama', linked_ids: { anilist: 101921 } },
  ]))));
  for (const artist of ['Gudrap', 'A new cover artist']) {
    await expect(resolveAnisongDB({ title: 'Chika Dance', artist })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  }
  await expect(resolveAnisongDB({ title: 'Chika Dance', artist: 'Konomi Kohara' })).resolves.toMatchObject([{ matchKind: 'confirmed' }]);
  await expect(resolveAnisongDB({ title: 'Chika Dance (Live)', artist: 'Gudrap' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
});

it('handles explicit TV Animation versions without stripping unqualified animation words', () => {
  for (const title of ['Theme (TV Animation Ver.)', 'Theme [TV Animation Version]', 'Theme - TV Animation Ver.']) expect(baseRecordingTitle(title)).toBe('Theme');
  for (const title of ['TV Animation Ver.', 'Theme (Animation)', 'Theme TV Animation']) expect(baseRecordingTitle(title)).toBeUndefined();
});

it('keeps publisher/composer credits scoped to the documented songs', () => {
  expect(canonicalArtistForTitle('Toki o Kizamu Uta', 'VISUAL ARTS / Key')).toBe(canonicalArtistForTitle('Toki o Kizamu Uta', 'Lia'));
  expect(canonicalArtistForTitle('Unrelated song', 'VISUAL ARTS / Key')).not.toBe(canonicalArtistForTitle('Unrelated song', 'Lia'));
  expect(canonicalArtistForTitle('Unrelated song', 'Syuji Katayama')).not.toBe(canonicalArtistForTitle('Unrelated song', 'Ainz Ooal Gown Gasshou-dan'));
});
