import { afterEach, expect, it, vi } from 'vitest';
import { resolveAnisongDB } from '../src/providers/anisongdb';
import { baseRecordingTitle, withoutAnimeCredit } from '../src/providers/song-titles';

afterEach(() => vi.unstubAllGlobals());
const cases = [
  { title: 'Pino To Ameri (Anime Size)', artist: 'Huwie Ishizaki', catalog: 'Pino to Amélie', credit: 'Huwie Ishizaki', anime: 'Naruto Shippuuden', kind: 'version' },
  { title: '花咲み', artist: 'シルフィエット(CV:茅野愛衣)', catalog: 'Hanaemi', credit: 'Ai Kayano', anime: 'Mushoku Tensei: Jobless Reincarnation Season 2', kind: 'confirmed' },
  { title: '終ワリノ歌', artist: 'Kenichiro Suehiro', catalog: 'Owari no Uta', credit: 'MAYUKO & Luminous', anime: "Girls' Last Tour", kind: 'confirmed' },
  { title: '幻想の輪舞', artist: 'Maon Kurosaki', catalog: 'Gensou no Rondo', credit: 'Maon Kurosaki', anime: 'Grisaia: Phantom Trigger the Animation', kind: 'confirmed' },
  { title: 'TVアニメ「この素晴らしい世界に祝福を!」エンディング・テーマ「ちいさな冒険者 (TV-size)」', artist: 'Sora Amamiya, Rie Takahashi & Ai Kayano', catalog: 'Chiisana Boukensha', credit: 'Sora Amamiya, Rie Takahashi, Ai Kayano', anime: "KONOSUBA: God's Blessing on This Wonderful World!", kind: 'version' },
  { title: 'Tada Yowai Dakejanakute Bokurawa - NARUTO Syonenhen Version', artist: 'Mass Alert', catalog: 'Tada Yowai dake ja Nakute Bokura wa...', credit: 'Mass Alert', anime: 'Naruto', kind: 'version' },
];

it.each(cases)('resolves screenshot metadata: $title', async ({ title, artist, catalog, credit, anime, kind }) => {
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([
    { songName: catalog, songArtist: credit, animeENName: anime, linked_ids: { anilist: 123 } },
    { songName: catalog, songArtist: 'Unrelated performer', animeENName: 'Unrelated namesake', linked_ids: { anilist: 456 } },
  ])));
  vi.stubGlobal('fetch', request);
  const matches = await resolveAnisongDB({ title, artist });
  expect(matches).toHaveLength(1);
  expect(matches).toMatchObject([{ title: anime, matchKind: kind }]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe(catalog);
  await expect(resolveAnisongDB({ title: 'Completely different song', artist })).resolves.toEqual([]);
  await expect(resolveAnisongDB({ title, artist: 'Unknown performer' })).resolves.not.toContainEqual(expect.objectContaining({ matchKind: 'confirmed' }));
});

it('strips explicit anime-size markers while retaining ordinary title words', () => {
  for (const title of ['Theme (Anime Size)', 'Theme [anime-size]', 'Theme - Anime Size']) expect(baseRecordingTitle(title)).toBe('Theme');
  for (const title of ['Anime Size', 'Theme Anime Size', 'Theme (Unknown Version)']) expect(baseRecordingTitle(title)).toBeUndefined();
});

it('unwraps only a complete TV anime music prefix with a quoted song', () => {
  expect(withoutAnimeCredit('TVアニメ「作品」エンディング・テーマ「曲 (TV-size)」')).toBe('曲 (TV-size)');
  for (const title of ['TVアニメ「作品」エンディング・テーマ', '「曲」', 'TVアニメ「作品」物語「曲」']) expect(withoutAnimeCredit(title)).toBe(title);
});

it('does not equate a solo Konosuba singer with the full trio', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
    { songName: 'Chiisana Boukensha', songArtist: 'Sora Amamiya, Rie Takahashi, Ai Kayano', animeENName: 'Konosuba', linked_ids: { anilist: 123 } },
  ]))));
  await expect(resolveAnisongDB({ title: 'ちいさな冒険者', artist: 'Ai Kayano' })).resolves.not.toContainEqual(expect.objectContaining({ matchKind: 'confirmed' }));
});
