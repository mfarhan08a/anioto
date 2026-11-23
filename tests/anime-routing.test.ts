import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ primary: vi.fn(), fallback: vi.fn(), enrich: vi.fn(), clear: vi.fn() }));
vi.mock('../src/providers/anisongdb', () => ({ resolveAnisongDB: mocks.primary }));
vi.mock('../src/providers/animethemes', () => ({ resolveAnime: mocks.fallback, enrich: mocks.enrich, clearAnimeCache: mocks.clear }));
import { clearAnimeCache, resolveAnime } from '../src/providers/anime';

const song = { title: 'Orange (Instrumental)', artist: 'seven oops' };
const match = { id: 20665, anilistId: 20665, title: 'Your Lie in April', sourceUrl: 'https://anisongdb.com/', evidence: 'AnisongDB credits Orange to 7!!.', matchKind: 'version' as const };
beforeEach(() => {
  clearAnimeCache(); vi.clearAllMocks();
  mocks.primary.mockReset().mockResolvedValue([match]);
  mocks.fallback.mockReset().mockResolvedValue([]);
  mocks.enrich.mockReset().mockResolvedValue({ coverUrl: 'https://example.com/cover.jpg' });
});
afterEach(() => { vi.useRealTimers(); clearAnimeCache(); });

it('briefly skips a 503 fallback without disabling primary lookup or caching a false no-match', async () => {
  vi.useFakeTimers();
  mocks.primary.mockResolvedValue([]);
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime(song)).rejects.toThrow('AnisongDB returned no matching credits. AnimeThemes');
  await expect(resolveAnime({ title: 'Unseen title', artist: 'New artist' })).rejects.toThrow('30 seconds');
  expect(mocks.primary).toHaveBeenCalledTimes(2);
  expect(mocks.fallback).toHaveBeenCalledTimes(1);
  mocks.primary.mockResolvedValue([match]);
  await expect(resolveAnime(song)).resolves.toMatchObject([{ id: match.id }]);
  clearAnimeCache();
  mocks.primary.mockResolvedValue([]);
  await expect(resolveAnime(song)).rejects.toThrow('HTTP 503');
  await vi.advanceTimersByTimeAsync(30_001);
  mocks.fallback.mockResolvedValue([]);
  await expect(resolveAnime(song)).resolves.toEqual([]);
  expect(mocks.fallback).toHaveBeenCalledTimes(3);
});

it('uses the primary source, publishes before artwork, and never calls the fallback on a hit', async () => {
  const observed = vi.fn();
  const result = await resolveAnime(song, undefined, observed);
  expect(observed).toHaveBeenCalledWith([expect.objectContaining({ title: match.title, matchKind: 'version' })]);
  expect(observed.mock.calls[0]![0][0]).not.toHaveProperty('coverUrl');
  expect(result).toMatchObject([{ title: match.title, coverUrl: 'https://example.com/cover.jpg' }]);
  expect(result[0]).not.toHaveProperty('anilistId');
  expect(mocks.enrich).toHaveBeenCalledWith('20665', expect.any(AbortSignal));
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it('does not let a bundled song mapping hide additional live anime credits', async () => {
  const known = { ...match, id: 155783, anilistId: 155783, title: 'Cyberpunk: Edgerunners', matchKind: 'confirmed' };
  const additional = { ...match, id: 999, anilistId: 999, title: 'Another source-documented use', matchKind: 'confirmed' };
  mocks.primary.mockResolvedValue([known, additional]);
  const result = await resolveAnime({ title: 'I Really Want to Stay At Your House', artist: 'Rosa Walton' });
  expect(result.map(value => value.id)).toEqual([155783, 999]);
  expect(result.every(value => value.sourceUrl === 'https://anisongdb.com/')).toBe(true);
  expect(mocks.primary).toHaveBeenCalledTimes(1);
});

const alya = 'アーリャ(CV:上坂すみれ)';
const alyaDuo = `${alya} & KAF`;
const alyaAnime = 'Alya Sometimes Hides Her Feelings in Russian';

it.each([
  ['1番輝く星', alya, 'Opening 1'],
  ['学園天国', alya, 'Ending 1'],
  ['可愛くてごめん', alya, 'Ending 2'],
  ['想い出がいっぱい', alya, 'Ending 3'],
  ['ハレ晴レユカイ', alya, 'Ending 4'],
  ['小さな恋のうた', alya, 'Ending 5'],
  ['秘密の言葉', alyaDuo, 'Ending 6'],
  ['ラブ・ストーリーは突然に', alya, 'Ending 7'],
  ['CHE.R.RY', alya, 'Ending 8'],
  ['ワールドイズマイン', alya, 'Ending 9'],
  ['こいのうた', alya, 'Ending 10'],
  ['気まぐれロマンティック', alya, 'Ending 11'],
  ['ハナモヨイ', alya, 'Ending 12'],
])('finds Alya’s season-one credit for %s without either remote catalog', async (title, artist, type) => {
  mocks.primary.mockRejectedValue(new Error('AnisongDB is unavailable (HTTP 503).'));
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime({ title, artist })).resolves.toMatchObject([
    { title: alyaAnime, type, matchKind: 'confirmed' },
  ]);
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it.each([
  ['ハレ晴レユカイ', 'Aya Hirano'],
  ['CHE.R.RY', 'YUI'],
  ['秘密の言葉', 'KAF'],
  ['秘密の言葉', alya],
  ['A Different Song', alya],
])('keeps %s by %s outside the Alya credits', async (title, artist) => {
  mocks.primary.mockResolvedValue([]);
  await expect(resolveAnime({ title, artist })).resolves.toEqual([]);
});

it('bounds optional artwork to 1.5 seconds even if fetch ignores abort', async () => {
  vi.useFakeTimers();
  mocks.enrich.mockImplementation(() => new Promise(() => {}));
  const pending = resolveAnime(song);
  await vi.advanceTimersByTimeAsync(1500);
  await expect(pending).resolves.toMatchObject([{ title: match.title }]);
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it('uses fallback on empty primary and on a primary failure, retaining its source evidence', async () => {
  mocks.primary.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('AnisongDB offline'));
  mocks.fallback.mockResolvedValue([{ ...match, sourceUrl: 'https://animethemes.moe/anime/example' }]);
  await expect(resolveAnime(song)).resolves.toMatchObject([{ sourceUrl: 'https://animethemes.moe/anime/example' }]);
  clearAnimeCache();
  await expect(resolveAnime(song)).resolves.toHaveLength(1);
  expect(mocks.fallback).toHaveBeenCalledTimes(2);
});

it('bounds a stalled fallback to five seconds and does not mistake errors for no matches', async () => {
  vi.useFakeTimers(); mocks.primary.mockResolvedValue([]);
  mocks.fallback.mockImplementation(() => new Promise(() => {}));
  const pending = resolveAnime(song);
  const assertion = expect(pending).rejects.toThrow('AnimeThemes fallback timed out');
  await vi.advanceTimersByTimeAsync(5000); await assertion;
  mocks.primary.mockRejectedValue(new Error('offline')); mocks.fallback.mockResolvedValue([]);
  await expect(resolveAnime(song)).rejects.toThrow('AnisongDB is unavailable');
  mocks.primary.mockRejectedValue(new Error('AnisongDB request timed out.'));
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime(song)).rejects.toThrow('AnisongDB request timed out. AnimeThemes is unavailable (HTTP 503).');
});

it('retains fallback credits already published if optional enrichment stalls', async () => {
  vi.useFakeTimers(); mocks.primary.mockResolvedValue([]);
  mocks.fallback.mockImplementation(async (_song, _signal, publish) => {
    await publish([match]);
    return new Promise(() => {});
  });
  const observed = vi.fn();
  const pending = resolveAnime(song, undefined, observed);
  await vi.advanceTimersByTimeAsync(5000);
  await expect(pending).resolves.toMatchObject([{ title: match.title }]);
  expect(observed).toHaveBeenCalledTimes(1);
});

it('reuses isolated successful results for an hour, but never caches an empty search', async () => {
  vi.useFakeTimers();
  const result = await resolveAnime(song); result[0]!.title = 'Caller changed it';
  await expect(resolveAnime(song)).resolves.toMatchObject([{ title: match.title }]);
  expect(mocks.primary).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3_600_001); await resolveAnime(song);
  expect(mocks.primary).toHaveBeenCalledTimes(2);
  clearAnimeCache(); mocks.primary.mockResolvedValue([]);
  await expect(resolveAnime(song)).resolves.toEqual([]); await resolveAnime(song);
  expect(mocks.primary).toHaveBeenCalledTimes(4);
});

it('honors cancellation during artwork and before returning cached results', async () => {
  await resolveAnime(song);
  const cancelled = new AbortController(); cancelled.abort();
  await expect(resolveAnime(song, cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' });
  clearAnimeCache(); mocks.enrich.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController(); const pending = resolveAnime(song, controller.signal);
  await vi.waitFor(() => expect(mocks.enrich).toHaveBeenCalledTimes(2));
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});

it('uses reviewed featured songs when the catalog misses and ranks the reviewed cover reference cautiously', async () => {
  mocks.primary.mockResolvedValue([]);
  await expect(resolveAnime({ title: 'I Really Want to Stay At Your House', artist: 'Rosa Walton' })).resolves.toMatchObject([{ title: 'Cyberpunk: Edgerunners' }]);
  expect(mocks.primary).toHaveBeenCalledTimes(1);
  mocks.primary.mockResolvedValue([{ ...match, id: 1, anilistId: 1, title: 'Another Orange', matchKind: 'possible' }, { ...match, matchKind: 'possible' }]);
  const result = await resolveAnime({ title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' });
  expect(result[0]).toMatchObject({ title: match.title, matchKind: 'possible', recordingReferenceUrl: expect.stringContaining('spotify.com') });
});

it.each([
  { title: 'Tagatame', artist: 'TK from Ling tosite sigure', matchKind: 'confirmed' },
  { title: 'Ta ga Tame', artist: 'TK from Ling tosite sigure', matchKind: 'confirmed' },
  { title: '誰我為 (TV Size)', artist: 'TK from 凛として時雨', matchKind: 'version' },
])('resolves $title during an anime catalog outage', async ({ title, artist, matchKind }) => {
  mocks.primary.mockRejectedValue(new Error('AnisongDB offline'));
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime({ title, artist })).resolves.toMatchObject([{
    title: 'My Hero Academia Season 7',
    type: 'Opening 1',
    matchKind,
    sourceUrl: 'https://heroaca.com/special/oped-oneforall/',
  }]);
  expect(mocks.primary).toHaveBeenCalledTimes(1);
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it('preserves the distinct AnisongDB credit for Ta ga Tame by Megatera Zero', async () => {
  mocks.primary.mockResolvedValue([{ ...match, id: 163205, anilistId: 163205, title: 'Malevolent Spirits: Mononogatari', matchKind: 'confirmed' }]);
  const song = { title: 'Ta ga Tame', artist: 'Megatera Zero' };
  await expect(resolveAnime(song)).resolves.toMatchObject([{ title: 'Malevolent Spirits: Mononogatari', matchKind: 'confirmed' }]);
  expect(mocks.primary).toHaveBeenCalledWith(song, undefined);
});

it('prefers the live STRAIGHT JET credit and uses the label credit when AnisongDB fails', async () => {
  const straightJet = { title: 'STRAIGHT JET', artist: 'Minami Kuribayashi' };
  const credit = { ...match, id: 9041, anilistId: 9041, title: 'Infinite Stratos', type: 'Opening 1', matchKind: 'confirmed' };
  mocks.primary.mockResolvedValueOnce([credit]).mockRejectedValue(new Error('AnisongDB request timed out.'));
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime(straightJet)).resolves.toMatchObject([{
    title: 'Infinite Stratos', type: 'Opening 1', sourceUrl: 'https://anisongdb.com/', coverUrl: 'https://example.com/cover.jpg',
  }]);
  clearAnimeCache();
  await expect(resolveAnime(straightJet)).resolves.toMatchObject([{
    title: 'Infinite Stratos', type: 'Opening 1', sourceUrl: 'https://lantis.jp/15th/special/kuribayashi.html',
  }]);
  await expect(resolveAnime({ ...straightJet, artist: 'Unrelated artist' })).rejects.toThrow('HTTP 503');
  expect(mocks.fallback).toHaveBeenCalledTimes(1);
});

it('uses the official BEAUTIFUL SKY credit when AnisongDB times out', async () => {
  const song = {
    title: 'BEAUTIFUL SKY',
    artist: 'シャルロット・デュノア(CV.花澤香菜), セシリア・オルコット(CV.ゆかな), ラウラ・ボーデヴィッヒ(CV.井上麻里奈), 凰鈴音(CV.下田麻美), 更識楯無(CV.斎藤千和), 更識簪(CV.三森すずこ) & 篠ノ之箒(CV.日笠陽子)',
  };
  mocks.primary.mockRejectedValue(new Error('AnisongDB request timed out.'));
  await expect(resolveAnime(song)).resolves.toMatchObject([{
    title: 'Infinite Stratos 2', type: 'Ending theme', matchKind: 'confirmed',
    sourceUrl: 'https://www.tbs.co.jp/anime/is2/news/news1310.html',
  }]);
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it.each([
  ['撃槍・ガングニール', 'Aoi Yuki', 'Symphogear', 'confirmed'],
  ['BLUE DREAM~夢旅人~(聖闘士星矢/TVサイズ)', '表記なし', 'Saint Seiya', 'possible'],
  ['Snake', 'Yorushika', 'Orb: On the Movements of the Earth', 'confirmed'],
  ['小さな僕らの大きなハート 【tvアニメ「古代王者 恐竜キング Dキッズ・アドベンチャー」主題歌】', 'ICHIKO', 'Dinosaur King', 'confirmed'],
  ['Boku ni dekirukoto', 'HOW MERRY MARRY', "Natsume's Book of Friends Season 3", 'confirmed'],
  ['夢にエール! パティシエール♪', 'Mayumi Gojo', 'Yumeiro Pâtissière', 'confirmed'],
  ['Ai Oboete Imasu ka - bless the little queen', 'Ranka Lee = Megumi Nakajima', 'Macross Frontier', 'confirmed'],
  ['花ハ踊レヤいろはにほ(Instrumental)', 'Team "Hanayamata"', 'Hanayamata', 'version'],
  ["Wind's Anthem (feat. suis From Yorushika)", 'EVE', 'Witch Hat Atelier', 'confirmed'],
  ['four covered by KAHONO', 'Megumi Han', 'Black Clover', 'confirmed'],
])('retains the documented association for %s during an outage', async (title, artist, anime, matchKind) => {
  mocks.primary.mockRejectedValue(new Error('AnisongDB is unavailable (HTTP 503).'));
  await expect(resolveAnime({ title, artist })).resolves.toMatchObject([{ title: anime, matchKind }]);
  expect(mocks.fallback).not.toHaveBeenCalled();
});

it('does not infer Saint Seiya from a generic English title with no artist credit', async () => {
  mocks.primary.mockResolvedValue([]);
  await expect(resolveAnime({ title: 'BLUE DREAM', artist: '表記なし' })).resolves.toEqual([]);
});

it('keeps a catalog English title when AniList only supplies Romaji', async () => {
  mocks.primary.mockResolvedValue([{ ...match, hasEnglishTitle: true }]);
  mocks.enrich.mockResolvedValue({ romajiTitle: 'Shigatsu wa Kimi no Uso' });
  const result = await resolveAnime(song);
  expect(result).toMatchObject([{ title: 'Your Lie in April', romajiTitle: 'Shigatsu wa Kimi no Uso' }]);
  expect(result[0]).not.toHaveProperty('hasEnglishTitle');
});

it.each([
  ['少年ケニヤ', '渡辺　典子', 'Kenya Boy', 'Opening 1', 'https://www.kadokawa.co.jp/product/video1107/'],
  ['すーぱー☆あふぇくしょん', 'Minami Kuribayashi, Hashimoto Miyuki, Faylan, Aki Misato, yozuca* & Rino', 'Carnival Phantasm', 'Opening 1', 'https://www.typemoon.com/products/cp/outline.html'],
  ['Deneb and Spica', 'DIALOGUE+', "My Stepmom's Daughter Is My Ex", 'Opening 1', 'https://www.ponycanyon.co.jp/music/PCCG000002164'],
  ["The Cruel Angel's Thesis", 'Yoko Takahashi', 'Neon Genesis Evangelion', 'Opening 1', 'https://www.youtube.com/watch?v=o6wtDPVkKqI'],
  ['Cure ~僕がここにいるよ~', 'デンデ (CV:平野 綾)', 'Dragon Ball Z Kai', 'Insert Song', 'https://columbia.jp/prod-info/COCX-35798/'],
  ['Kimino Ginno Niwa', 'Kalafina', 'Puella Magi Madoka Magica the Movie: Rebellion', 'Ending 1', 'https://www.madoka-magica.com/rebellion/news/?id=27218'],
  ['REVIVER', 'Hiroyuki Sawano', 'Solo Leveling Season 2: Arise from the Shadow', 'Insert Song', 'https://www.aniplex.co.jp/news/detail/?id=67275'],
  ['すているめいと!', 'IOSYS JK Girls', 'D-Frag!', 'Opening 1', 'https://d-fragments.net/products/music.html'],
  ['Mata Kimini Aeruhi', 'Shion Miyawaki', 'Assassination Classroom Second Season', 'Ending 2', 'https://www.ansatsu-anime.com/2014-2016/news/detail.php?id=1033336'],
  ['Shunkashuto', 'sumika', 'I Want to Eat Your Pancreas', 'Ending 1', 'https://kimisui-anime.com/news/?article_id=47814'],
  ['Solanetarium', 'MICHI', 'The Girl in Twilight', 'Opening 1', 'https://www.ytv.co.jp/akanesasus/'],
  ['L・O・V・E・LY LOCO', 'Loco Musica (CV: Yuuka Aisaka)', 'Gushing Over Magical Girls', 'Insert Song', 'https://www.youtube.com/watch?v=uxPavPqtuGc'],
])('resolves %s from official credits during a catalog outage', async (title, artist, anime, type, sourceUrl) => {
  mocks.primary.mockRejectedValue(new Error('AnisongDB is unavailable (HTTP 503).'));
  mocks.fallback.mockRejectedValue(new Error('AnimeThemes is unavailable (HTTP 503).'));
  await expect(resolveAnime({ title, artist })).resolves.toMatchObject([{ title: anime, type, sourceUrl, matchKind: 'confirmed' }]);
  expect(mocks.fallback).not.toHaveBeenCalled();
  mocks.primary.mockResolvedValue([]);
  mocks.fallback.mockResolvedValue([]);
  await expect(resolveAnime({ title, artist: 'Different performer' })).resolves.toEqual([]);
});

it.each([
  ['Bios <MK+nZk Version>', 'Hiroyuki Sawano', 'Guilty Crown', 'confirmed'],
  ['Inori no Uta (Acoustic Guitar Ver.)', 'Itsuki Inubouzaki', 'Yuki Yuna Is a Hero', 'version'],
  ['どんな星空よりも、どんな思い出よりも', 'Aira Yuuki', "A Sister's All You Need.", 'confirmed'],
  ['恋のバルーン', '大島はるな', 'My Sweet Tyrant', 'confirmed'],
  ['ドイツに捧げるイタリアのうた', 'イタリア(CV:浪川大輔)', 'Hetalia Axis Powers', 'confirmed'],
  ['ムスビメ', 'Yuiko Ohara', 'Mushoku Tensei: Jobless Reincarnation Season 2', 'confirmed'],
  ['Symphonicsuite (Aot), Pt. 2-1st: Attack on Titan (Wmid)', 'Hiroyuki Sawano', 'Attack on Titan Season 3', 'confirmed'],
  ['Watashiwa Watashino Kotoga Suki', 'HoneyWorks, Cosmic Princess Kaguya! & Kaguya(cv.Yuko Natsuyoshi)', 'Cosmic Princess Kaguya!', 'confirmed'],
  ['Black Rock Shooter (feat. Hatsune Miku) [2M Mix]', 'ryo', 'Black★Rock Shooter', 'version'],
  ['また君に会える日 (カラオケ)', '宮脇詩音', 'Assassination Classroom Second Season', 'version'],
  ['Dame Wa Dame (Jo Mino Ver.)', 'Minori Suzuki', 'Magical Sempai', 'version'],
  ['恋のヒミツ', 'Puare', 'My Girlfriend is Shobitch', 'confirmed'],
  ['Mermaid Love Story', 'Miku Izayoi (CV: Minori Chihara)', 'Date A Live II', 'confirmed'],
  ['Saibo Kioku', 'nano.RIPE', 'Hanasaku Iroha: Blossoms for Tomorrow', 'confirmed'],
  ['プラチナ17', 'CooRie & yozuca*', 'So, I Can’t Play H?', 'possible'],
  ['Fuyubiyori', 'Eri Sasaki', 'Laid-Back Camp', 'confirmed'],
  ['The Theme of Bangaichi (Celebration)', 'Michael Kaneko', 'Megalobox', 'confirmed'],
  ['ワールドイズマイン', 'アーリャ(CV:上坂すみれ)', 'Alya Sometimes Hides Her Feelings in Russian', 'confirmed'],
  ['小さな恋のうた', 'アーリャ(CV:上坂すみれ)', 'Alya Sometimes Hides Her Feelings in Russian', 'confirmed'],
  ['こいのうた', 'アーリャ(CV:上坂すみれ)', 'Alya Sometimes Hides Her Feelings in Russian', 'confirmed'],
])('resolves the reported screenshot case %s during a catalog outage', async (title, artist, anime, matchKind) => {
  mocks.primary.mockRejectedValue(new Error('AnisongDB is unavailable (HTTP 503).'));
  await expect(resolveAnime({ title, artist })).resolves.toMatchObject([{ title: anime, matchKind }]);
  expect(mocks.fallback).not.toHaveBeenCalled();
});
