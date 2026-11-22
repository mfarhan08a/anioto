import { afterEach, expect, it, vi } from 'vitest';
import { resolveAnisongDB } from '../src/providers/anisongdb';
import { baseRecordingTitle, withoutAnimeCredit } from '../src/providers/song-titles';

afterEach(() => vi.unstubAllGlobals());
const cases = [
  { title: 'Sound of Destiny (Live at Campus Fes) [TV Anime Ver.]', artist: 'Setsuna Ogiso (CV: Madoka Yonezawa)', catalog: 'SOUND OF DESTINY', credit: 'Madoka Yonezawa', anime: 'White Album 2', kind: 'version' },
  { title: '夢路らびりんす', artist: 'らびりんず 千矢(CV.原田彩楓)&紺(CV.本渡 楓)&小梅(CV.久保ユリカ)&ノノ(CV.佳村はるか)', catalog: 'Yumeji Labyrinth', credit: 'Labyrinths', anime: 'Urara Meirocho', kind: 'confirmed' },
  { title: 'LOVE 2000', artist: 'Anna Yanami (CV: Hikaru Tono)', catalog: 'LOVE2000', credit: 'Hikaru Toono', anime: 'Makeine: Too Many Losing Heroines!', kind: 'confirmed' },
  { title: 'STEEL', artist: 'TRUE', catalog: 'STEEL -Tekketsu no Kizuna-', credit: 'TRUE', anime: 'Mobile Suit Gundam: Iron-Blooded Orphans', kind: 'confirmed' },
  { title: "After All Tsuduru Omoi '13", artist: 'Rena Uehara', catalog: "After All ~Tsuzuru Omoi~ '13", credit: 'Rena Uehara', anime: 'White Album 2', kind: 'confirmed' },
  { title: '夏を見ていた～「蛍火の杜へ」エンディングテーマ', artist: 'Sizzle Ohtaka', catalog: 'Natsu o Miteita', credit: 'Shizuru Ohtaka', anime: 'The Light of a Firefly Forest', kind: 'confirmed' },
  { title: 'Wrong World', artist: 'TOGENASHI TOGEARI', catalog: 'Zattou, Bokura no Machi', credit: 'TOGENASHI TOGEARI', anime: 'Girls Band Cry', kind: 'confirmed' },
];

it.each(cases)('resolves reported release metadata: $title', async ({ title, artist, catalog, credit, anime, kind }) => {
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([
    { songName: catalog, songArtist: credit, animeENName: anime, linked_ids: { anilist: 123 } },
    { songName: catalog, songArtist: 'Unrelated singer', animeENName: 'Unrelated anime', linked_ids: { anilist: 456 } },
  ])));
  vi.stubGlobal('fetch', request);
  expect(await resolveAnisongDB({ title, artist })).toMatchObject([{ title: anime, matchKind: kind }]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe(catalog);
  expect((await resolveAnisongDB({ title, artist: 'Unknown performer' })).every(match => match.matchKind === 'possible')).toBe(true);
  await expect(resolveAnisongDB({ title: 'Unrelated title', artist })).resolves.toEqual([]);
});

it('handles two explicit live/TV anime suffixes without removing ordinary anime words', () => {
  expect(baseRecordingTitle('Sound of Destiny (Live at Campus Fes) [TV Anime Ver.]')).toBe('Sound of Destiny');
  for (const title of ['Theme [TV Anime]', 'Theme Anime', 'TV Anime Version']) expect(baseRecordingTitle(title)).toBeUndefined();
});

it('removes a separated anime-theme credit without reading it as the song title', () => {
  expect(withoutAnimeCredit('夏を見ていた～「蛍火の杜へ」エンディングテーマ')).toBe('夏を見ていた');
  expect(withoutAnimeCredit('Song ~「Series」オープニング・テーマ')).toBe('Song');
  for (const title of ['「Series」エンディングテーマ', 'Song「Series」エンディングテーマ', 'Song ~「Series」物語']) expect(withoutAnimeCredit(title)).toBe(title);
});

it('keeps the White Album singers separate', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { songName: 'SOUND OF DESTINY', songArtist: 'Nana Mizuki', animeENName: 'White Album', linked_ids: { anilist: 4720 } },
    { songName: 'SOUND OF DESTINY', songArtist: 'Madoka Yonezawa', animeENName: 'White Album 2', linked_ids: { anilist: 18245 } },
  ]))));
  const matches = await resolveAnisongDB(cases[0]!);
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ id: 18245, matchKind: 'version' });
});

it('does not replace the meaningful After All recording year or turn a soloist into Labyrinths', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { songName: "After All ~Tsuzuru Omoi~ '13", songArtist: 'Rena Uehara', animeENName: 'White Album 2', linked_ids: { anilist: 18245 } },
    { songName: 'Yumeji Labyrinth', songArtist: 'Labyrinths', animeENName: 'Urara Meirocho', linked_ids: { anilist: 21696 } },
  ]))));
  await expect(resolveAnisongDB({ title: "After All Tsuduru Omoi '10", artist: 'Rena Uehara' })).resolves.toEqual([]);
  expect((await resolveAnisongDB({ title: '夢路らびりんす', artist: 'Sayaka Harada' })).every(match => match.matchKind === 'possible')).toBe(true);
});
