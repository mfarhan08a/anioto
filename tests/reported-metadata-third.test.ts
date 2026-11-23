import { afterEach, expect, it, vi } from 'vitest';
import { resolveAnisongDB } from '../src/providers/anisongdb';

afterEach(() => vi.unstubAllGlobals());
const cases = [
  { title: 'はじまりの場所', artist: 'Rie Murakawa', catalog: 'Hajimari no Basho', credit: 'Rie Murakawa', anime: 'Forest of Piano' },
  { title: 'ベラフの子守歌', artist: 'Kevin Penkin', catalog: 'Belaf no Komoriuta', credit: 'Mitsuki Saiga', anime: 'Made in Abyss: The Golden City of the Scorching Sun' },
  { title: 'Anone', artist: 'Yuna (CV: Maki Kawase)', catalog: 'Ano ne.', credit: 'Maki Kawase', anime: 'Kuma Kuma Kuma Bear' },
  { title: 'Lullaby In the Peaceful Light', artist: 'Masakatsu Takagi', catalog: 'Hidamari no Mori Uta', credit: 'Masakatsu Takagi', anime: 'Wolf Children' },
  { title: 'Comedy', artist: 'Gen Hoshino', catalog: 'Kigeki', credit: 'Gen Hoshino', anime: 'Spy × Family' },
  { title: 'The secret of happiness', artist: 'Akane Kumada', catalog: 'Happy no Hiketsu', credit: 'Akane Kumada', anime: 'I Was Reincarnated as the 7th Prince So I Can Take My Time Perfecting My Magical Ability' },
  { title: 'Rhapsody of Blue Sky', artist: 'Fhána', catalog: 'Aozora no Rhapsody', credit: 'fhána', anime: "Miss Kobayashi's Dragon Maid" },
  { title: '瞳ニ映ル景色', artist: 'Kenichirou Suehiro', catalog: 'Hitomi ni Utsuru Keshiki', credit: 'MAYUKO & Luminous', anime: "Girls' Last Tour" },
  { title: 'インキャインパルス (feat. Ikepy & KSKN)', artist: '本田華子(CV:木野日菜), オリヴィア(CV:長江里加), 野村香純(CV:小原好美) feat. Ikepy & KSKN', catalog: 'Inkya Impulse', credit: 'Hina Kino, Rika Nagae, Konomi Kohara feat. Ikepy & KSKN', anime: 'Asobi Asobase: Workshop of Fun' },
  { title: 'Hengen Jizaino Majikaru Star', artist: 'GRANRODEO', catalog: 'Hengenjizai no Magical Star', credit: 'GRANRODEO', anime: "Kuroko's Basketball" },
];

it.each(cases)('matches the catalog for $title without using an anime-name override', async ({ title, artist, catalog, credit, anime }) => {
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([
    { songName: catalog, songArtist: credit, animeENName: anime, linked_ids: { anilist: 123 } },
    { songName: catalog, songArtist: 'Unrelated performer', animeENName: 'Unrelated namesake', linked_ids: { anilist: 456 } },
  ])));
  vi.stubGlobal('fetch', request);
  const result = await resolveAnisongDB({ title, artist });
  expect(result).toHaveLength(1);
  expect(result).toMatchObject([{ title: anime, matchKind: 'confirmed' }]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe(catalog);
  expect((await resolveAnisongDB({ title, artist: 'Unknown performer' })).every(match => match.matchKind === 'possible')).toBe(true);
  await expect(resolveAnisongDB({ title: 'Different song', artist })).resolves.toEqual([]);
});

it('keeps the Ano ne solo recording separate from the duet release', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { songName: 'Ano ne.', songArtist: 'Maki Kawase', animeENName: 'Kuma Kuma Kuma Bear', linked_ids: { anilist: 114340 } },
  ]))));
  await expect(resolveAnisongDB({ title: 'Anone', artist: 'Yuna (CV: Maki Kawase) & Fina (CV: Azumi Waki)' })).resolves.toEqual([]);
});

it('does not assign a stock library song to Gintama without catalog evidence', async () => {
  const request = vi.fn(async () => new Response('[]'));
  vi.stubGlobal('fetch', request);
  await expect(resolveAnisongDB({ title: 'Milky Way War History', artist: 'Nash Music Library' })).resolves.toEqual([]);
  expect(request.mock.calls.length).toBeLessThanOrEqual(5);
});
