import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAnisongDB } from '../src/providers/anisongdb';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const entry = (overrides: Record<string, unknown> = {}) => ({
  songName: 'Theme', songArtist: 'The Artist', songType: 'OP', animeENName: 'A Show',
  linked_ids: { anilist: 123, myanimelist: 456 }, ...overrides,
});

describe('resolveAnisongDB', () => {
  it('maps the Japanese Asobi Asobase trio credit to the live catalog title without another lookup', async () => {
    const artist = '本田華子(CV:木野日菜), オリヴィア(CV:長江里加) & 野村香純(CV:小原好美)';
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({
      songName: 'Three-Piece', songArtist: 'Hina Kino, Rika Nagae, Konomi Kohara',
      animeENName: 'Asobi Asobase: Workshop of Fun',
    })]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: 'スリピス', artist })).resolves.toMatchObject([{ matchKind: 'confirmed' }]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe('Three-Piece');
    await expect(resolveAnisongDB({ title: 'スリピス (instrumental)', artist })).resolves.toMatchObject([{ matchKind: 'version' }]);
    await expect(resolveAnisongDB({ title: 'スリピス', artist: 'Hina Kino' })).resolves.toEqual([]);
    await expect(resolveAnisongDB({ title: 'Unrelated song', artist })).resolves.toEqual([]);
  });

  it('matches the bilingual globe title and keeps the Saint Seiya namesake separate', async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'Chikyuugi', songArtist: 'Yumi Matsuzawa', animeENName: 'Saint Seiya', linked_ids: { anilist: 1257 } }),
      entry({ songName: 'Chikyuugi', songArtist: 'Kenshi Yonezu', animeENName: 'The Boy and the Heron', linked_ids: { anilist: 109979 } }),
    ]));
    vi.stubGlobal('fetch', request);
    for (const title of ['Chikyugi - Spinning Globe', 'Chikyugi', '地球儀', 'Spinning Globe']) {
      const matches = await resolveAnisongDB({ title, artist: 'Kenshi Yonezu' });
      expect(matches).toMatchObject([{ id: 109979, matchKind: 'confirmed' }]);
      expect(matches).toHaveLength(1);
    }
    expect(request).toHaveBeenCalledTimes(4);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).song_name_search_filter.search).toBe('Chikyuugi');
    await expect(resolveAnisongDB({ title: 'Chikyugi - Spinning Globe', artist: 'Unrelated artist' })).resolves.toEqual([]);
    await expect(resolveAnisongDB({ title: 'Spinning Globe - Different Song', artist: 'Kenshi Yonezu' })).resolves.toEqual([]);
  });

  it('uses the exact Bios arrangement credit and keeps its composer alias scoped to that song', async () => {
    const title = 'Bios <MK+nZk Version>';
    const artist = 'Hiroyuki Sawano';
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'βίος <MK+nZk Version>', songArtist: 'Mika Kobayashi', animeENName: 'Guilty Crown', songType: 'Insert Song' }),
    ]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title, artist })).resolves.toMatchObject([{ title: 'Guilty Crown', type: 'Insert Song', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'βίος <MK+nZk Version>' } });
    request.mockImplementation(async () => json([entry({ songName: 'βίος', songArtist: 'Mika Kobayashi' })]));
    await expect(resolveAnisongDB({ title: 'βίος', artist })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });

  it('matches Itsuki’s acoustic guitar arrangement without confirming another Inori no Uta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({ songName: 'Inori no Uta', songArtist: 'Yuiko Ohara', animeENName: 'Mushoku Tensei', linked_ids: { anilist: 127720 } }),
      entry({ songName: 'Inori no Uta', songArtist: 'Tomoyo Kurosawa', animeENName: 'Yuki Yuna is a Hero', songType: 'Ending 3', linked_ids: { anilist: 20800 } }),
    ])));
    const matches = await resolveAnisongDB({ title: 'Inori no Uta (Acoustic Guitar Ver.)', artist: 'Itsuki Inubouzaki' });
    expect(matches.map(({ id, type, matchKind }) => ({ id, type, matchKind }))).toEqual([{ id: 20800, type: 'Ending 3', matchKind: 'version' }]);
  });

  it('matches Kaguya’s combined release credit to the catalog performer for this song', async () => {
    const credit = entry({ songName: 'Watashi wa, Watashi no Koto ga Suki.', songArtist: 'Yuuko Natsuyoshi', animeENName: 'Cosmic Princess Kaguya!', songType: 'Insert Song' });
    const request = vi.fn(async () => json([credit]));
    vi.stubGlobal('fetch', request);
    const artist = 'HoneyWorks, Cosmic Princess Kaguya! & Kaguya(cv.Yuko Natsuyoshi)';
    const title = 'Watashiwa Watashino Kotoga Suki';
    await expect(resolveAnisongDB({ title, artist })).resolves.toMatchObject([{ title: 'Cosmic Princess Kaguya!', matchKind: 'confirmed' }]);
    await expect(resolveAnisongDB({ title, artist: 'HoneyWorks' })).resolves.toEqual([]);
    request.mockImplementation(async () => json([entry({ songArtist: 'Yuuko Natsuyoshi' })]));
    await expect(resolveAnisongDB({ title: 'Theme', artist })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });

  it('links the reviewed Black Rock Shooter 2M Mix to the underlying TV opening as a version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({
      songName: 'Black★Rock Shooter', songArtist: 'supercell feat. Hatsune Miku',
      animeENName: 'Black★Rock Shooter', songType: 'Opening 1', linked_ids: { anilist: 11285 },
    })])));
    await expect(resolveAnisongDB({ title: 'Black Rock Shooter (feat. Hatsune Miku) [2M Mix]', artist: 'ryo' }))
      .resolves.toMatchObject([{ id: 11285, type: 'Opening 1', matchKind: 'version' }]);
  });

  it('verifies the complete Carnival Phantasm lineup and excludes the Fate/Grand Carnival recording', async () => {
    const primary = entry({ songName: 'Super☆Affection', songArtist: 'Minami Kuribayashi, Miyuki Hashimoto, Faylan, Aki Misato, yozuca*, rino', animeENName: 'Carnival Phantasm', songType: 'Opening 1', linked_ids: { anilist: 10012 } });
    const cover = entry({ songName: 'Super☆Affection', songArtist: 'Rie Takahashi, Minami Tanaka, Rumi Okubo', animeENName: 'Fate/Grand Carnival', songType: 'Opening 1', linked_ids: { anilist: 127149 } });
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([cover, primary]));
    vi.stubGlobal('fetch', request);
    const title = 'すーぱー☆あふぇくしょん';
    const artist = 'Minami Kuribayashi, Hashimoto Miyuki, Faylan, Aki Misato, yozuca* & Rino';
    const result = await resolveAnisongDB({ title, artist });
    expect(result.map(({ id, matchKind }) => ({ id, matchKind }))).toEqual([{ id: 10012, matchKind: 'confirmed' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: primary.songName } });
    await expect(resolveAnisongDB({ title, artist: 'Minami Kuribayashi' })).resolves.toEqual([]);
  });

  it('matches Dende’s full Cure title and actor credit without matching another song called Cure', async () => {
    const primary = entry({ songName: 'CURE ~Boku ga Koko ni Iru yo~', songArtist: 'Aya Hirano', animeENName: 'Dragon Ball Z Kai', songType: 'Insert Song', linked_ids: { anilist: 6033 } });
    const unrelated = entry({ songName: 'Cure', songArtist: 'waterweed', animeENName: 'The Wrong Way to Use Healing Magic', linked_ids: { anilist: 137908 } });
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([unrelated, primary]));
    vi.stubGlobal('fetch', request);
    const matches = await resolveAnisongDB({ title: 'Cure ~僕がここにいるよ~', artist: 'デンデ (CV:平野 綾)' });
    expect(matches.map(({ id, matchKind }) => ({ id, matchKind }))).toEqual([{ id: 6033, matchKind: 'confirmed' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: primary.songName } });
  });

  it('recovers omitted word boundaries only for an unambiguous performer credit', async () => {
    const song = { title: 'Kimino Ginno Niwa', artist: 'Kalafina' };
    const credit = entry({ songName: 'Kimi no Gin no Niwa', songArtist: 'Kalafina', animeENName: 'Puella Magi Madoka Magica the Movie: Rebellion', songType: 'Ending 1' });
    const requests = vi.fn().mockImplementationOnce(() => json([])).mockImplementationOnce(() => json([credit]));
    vi.stubGlobal('fetch', requests);
    await expect(resolveAnisongDB(song)).resolves.toMatchObject([{ title: credit.animeENName, type: 'Ending 1', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(requests.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: song.title } });
    expect(JSON.parse(String(requests.mock.calls[1]?.[1]?.body))).toMatchObject({ artist_search_filter: { search: song.artist } });

    requests.mockImplementation(() => json([credit]));
    await expect(resolveAnisongDB({ ...song, artist: 'Different performer' })).resolves.toEqual([]);

    requests.mockImplementation(() => json([credit, { ...credit, songName: 'Kimino Gin no Niwa', animeENName: 'Another anime', linked_ids: { anilist: 901 } }]));
    await expect(resolveAnisongDB(song)).resolves.toEqual([]);
  });

  it('keeps Sawano’s stylized insert song separate from the same-title Hortensia Saga song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({ songName: 'REVIVER', songArtist: 'MY FIRST STORY', animeENName: 'Hortensia Saga', linked_ids: { anilist: 114301 } }),
      entry({ songName: 'REVIVƎЯ', songArtist: 'Hiroyuki SAWANO feat. SennaRin', artists: [{ names: ['Hiroyuki Sawano'] }], animeENName: 'Solo Leveling Season 2: Arise from the Shadow', songType: 'Insert Song', linked_ids: { anilist: 176496 } }),
    ])));
    await expect(resolveAnisongDB({ title: 'REVIVER', artist: 'Hiroyuki Sawano' }))
      .resolves.toMatchObject([{ id: 176496, type: 'Insert Song', matchKind: 'confirmed' }]);
    await expect(resolveAnisongDB({ title: 'REVIVER', artist: 'MY FIRST STORY' }))
      .resolves.toMatchObject([{ id: 114301, matchKind: 'confirmed' }]);
  });

  it.each(['(カラオケ)', '（インストゥルメンタル）', '[オフ・ボーカル版]'])('queries the base song for the Japanese recording label %s', async suffix => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'Mata Kimi ni Aeru Hi', songArtist: 'Shion Miyawaki', animeENName: 'Assassination Classroom Second Season', songType: 'Ending 2' }),
    ]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: `また君に会える日 ${suffix}`, artist: '宮脇詩音' }))
      .resolves.toMatchObject([{ title: 'Assassination Classroom Second Season', type: 'Ending 2', matchKind: 'version' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Mata Kimi ni Aeru Hi' } });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Shunkashuto', 'sumika', 'Shunkashuutou', 'sumika', 'I Want To Eat Your Pancreas', 'Ending 1'],
    ['Solanetarium', 'MICHI', 'Soranetarium', 'MICHI', 'The Girl in Twilight', 'Opening 1'],
    ['L·O·V·E·LY LOCO', 'Loco Musica (CV: Yuuka Aisaka)', 'L・O・V・E・Ly Loco♡', 'Yuuka Aisaka', 'Gushing Over Magical Girls', 'Insert Song'],
  ])('sends the catalog title for %s and confirms the performer', async (title, artist, songName, songArtist, animeENName, songType) => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName, songArtist, animeENName, songType })]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title, artist })).resolves.toMatchObject([{ title: animeENName, type: songType, matchKind: 'confirmed' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: songName, partial_match: false } });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('resolves Jo Mino as an artist-verified album version of the Magical Sempai ending', async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'Dame wa Dame', songArtist: 'Minori Suzuki', animeENName: 'Magical Sempai', songType: 'Ending 1' }),
    ]));
    vi.stubGlobal('fetch', request);
    const title = 'Dame Wa Dame (Jo Mino Ver.)';
    await expect(resolveAnisongDB({ title, artist: 'Minori Suzuki' }))
      .resolves.toMatchObject([{ title: 'Magical Sempai', matchKind: 'version' }]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      song_name_search_filter: { search: 'Dame wa Dame' },
    });
    await expect(resolveAnisongDB({ title, artist: 'Different singer' })).resolves.toEqual([]);
  });

  it('prefers Alya’s documented cover over other anime that use the same song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({ songName: 'Chiisana Koi no Uta', songArtist: 'Rie Takahashi', animeENName: 'Teasing Master Takagi-san', linked_ids: { anilist: 99468 } }),
      entry({ songName: 'Chiisana Koi no Uta', songArtist: 'Sumire Uesaka', animeENName: 'Alya Sometimes Hides Her Feelings in Russian', songType: 'Ending 5', linked_ids: { anilist: 162804 } }),
    ])));
    await expect(resolveAnisongDB({ title: '小さな恋のうた', artist: 'アーリャ(CV:上坂すみれ)' }))
      .resolves.toMatchObject([{ title: 'Alya Sometimes Hides Her Feelings in Russian', type: 'Ending 5', matchKind: 'confirmed' }]);
  });

  it.each(['アーリャ(CV:上坂すみれ) & KAF', 'アーリャ（CV：上坂すみれ）×花譜'])(
    'matches Alya and KAF’s duet in a single title search for %s', async artist => {
      const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
        entry({ songName: 'Himitsu no Kotoba', songArtist: 'Sumire Uesaka×KAF',
          animeENName: 'Alya Sometimes Hides Her Feelings in Russian', songType: 'Ending 6', linked_ids: { anilist: 162804 } }),
      ]));
      vi.stubGlobal('fetch', request);
      await expect(resolveAnisongDB({ title: '秘密の言葉', artist }))
        .resolves.toMatchObject([{ type: 'Ending 6', matchKind: 'confirmed' }]);
      expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
        song_name_search_filter: { search: 'Himitsu no Kotoba', partial_match: false },
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('matches the Black Clover cover to Megumi Han’s ending credit', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'four', songArtist: 'FAKY', animeENName: 'Black Clover', songType: 'Ending 4' }),
      entry({ songName: 'four', songArtist: 'Megumi Han', animeENName: 'Black Clover', songType: 'Ending 5' }),
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'four covered by KAHONO', artist: 'Megumi Han' }))
      .resolves.toMatchObject([{ title: 'Black Clover', type: 'Ending 5', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      song_name_search_filter: { search: 'four' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('looks up Eve’s Wind’s Anthem by catalog title and verifies the credited lead artist', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName: 'Kaze no Anthem', songArtist: 'Eve feat. suis from Yorushika',
        artists: [{ names: ['Eve'] }, { names: ['suis from Yorushika'] }],
        animeENName: 'Witch Hat Atelier', songType: 'Opening 1' }),
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: "Wind's Anthem (feat. suis From Yorushika)", artist: 'EVE' }))
      .resolves.toMatchObject([{ title: 'Witch Hat Atelier', type: 'Opening 1', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      song_name_search_filter: { search: 'Kaze no Anthem' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['Snake', 'Yorushika', 'Hebi', 'Orb: On the Movements of the Earth'],
    ['Sunny', 'ヨルシカ', 'Haru', "Frieren: Beyond Journey's End"],
    ['Moonbath', 'Yorushika', 'Gekkouyoku', 'Kaina of the Great Snow Sea: Star Sage'],
    ['Martian', 'ヨルシカ', 'Kaseijin', 'SHOSHIMIN: How to Become Ordinary'],
    ['Ghost in a Flower', 'Yorushika', 'Hana ni Bourei', 'A Whisker Away'],
  ])('queries the catalogue title for %s in a single request', async (title, artist, songName, animeENName) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([
      entry({ songName, songArtist: 'Yorushika', animeENName }),
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title, artist })).resolves.toMatchObject([{ title: animeENName, matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      song_name_search_filter: { search: songName },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires a Yorushika song credit even when artist discovery returns other anime themes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({ songName: 'Hebi', songArtist: 'Yorushika' }),
      entry({ songName: 'Haru', songArtist: 'Yorushika' }),
    ])));
    await expect(resolveAnisongDB({ title: 'Rubato', artist: 'Yorushika' })).resolves.toEqual([]);
    await expect(resolveAnisongDB({ title: 'Snake', artist: 'Different Artist' })).resolves.toEqual([]);
  });

  it('keeps the exact Macross Frontier arrangement separate from the original Macross song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({
        songName: 'Ai Oboete Imasu ka', songArtist: 'Mari Iijima', animeENName: 'Do You Remember Love?',
        linked_ids: { anilist: 1089 },
      }),
      entry({
        songName: 'Ai Oboete Imasu ka ~bless the little queen', songArtist: 'Megumi Nakajima', animeENName: 'Macross Frontier',
        linked_ids: { anilist: 3572 },
      }),
    ])));
    await expect(resolveAnisongDB({
      title: 'Ai Oboete Imasu ka - bless the little queen', artist: 'Ranka Lee = Megumi Nakajima',
    })).resolves.toMatchObject([{ title: 'Macross Frontier', matchKind: 'confirmed' }]);
    await expect(resolveAnisongDB({
      title: 'Ai Oboete Imasu ka', artist: 'Mari Iijima',
    })).resolves.toMatchObject([{ title: 'Do You Remember Love?', matchKind: 'confirmed' }]);
  });

  it('matches the Japanese BEAUTIFUL SKY cast to the seven-performer ending credit', async () => {
    const five = 'Yoko Hikasa, Yukana, Asami Shimoda, Kana Hanazawa, Marina Inoue';
    const six = `${five}, Suzuko Mimori`;
    const rows = [five, six, `${six}, Chiwa Saito`].map((songArtist, index) =>
      entry({ songName: 'BEAUTIFUL SKY', songArtist, animeENName: 'Infinite Stratos 2', songType: `Ending ${index + 1}` }));
    const fetchMock = vi.fn(async () => json(rows));
    vi.stubGlobal('fetch', fetchMock);
    const artist = 'シャルロット・デュノア(CV.花澤香菜), セシリア・オルコット(CV.ゆかな), ラウラ・ボーデヴィッヒ(CV.井上麻里奈), 凰鈴音(CV.下田麻美), 更識楯無(CV.斎藤千和), 更識簪(CV.三森すずこ) & 篠ノ之箒(CV.日笠陽子)';
    await expect(resolveAnisongDB({ title: 'BEAUTIFUL SKY', artist })).resolves.toMatchObject([
      { title: 'Infinite Stratos 2', type: 'Ending 3', matchKind: 'confirmed' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(resolveAnisongDB({ title: 'BEAUTIFUL SKY', artist: five })).resolves.toMatchObject([
      { title: 'Infinite Stratos 2', type: 'Ending 1', matchKind: 'confirmed' },
    ]);
  });
  it.each(['Saori Kodama', 'Saori Codama', 'こだまさおり'])('resolves Mikansei Stride with verified performer spelling %s', async artist => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Mikansei Stride', songArtist: 'Saori Codama', animeENName: 'Hyouka', songType: 'Opening 2' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: '未完成ストライド', artist })).resolves.toMatchObject([{ title: 'Hyouka', type: 'Opening 2', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Mikansei Stride' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains performer verification and different-song rejection for Mikansei Stride', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Mikansei Stride', songArtist: 'Saori Codama' })])));
    await expect(resolveAnisongDB({ title: 'Mikansei Stride', artist: 'Unrelated singer' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
    await expect(resolveAnisongDB({ title: 'Different song', artist: 'Saori Kodama' })).resolves.toEqual([]);
  });
  it('resolves a First Take session as a version while preserving artist verification', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Akuma no Ko', songArtist: 'Ai Higuchi', animeENName: 'Attack on Titan Final Season', songType: 'Ending 1' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'Akuma no Ko - From the First Take', artist: 'Ai Higuchi' })).resolves.toMatchObject([{ title: 'Attack on Titan Final Season', type: 'Ending 1', matchKind: 'version' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Akuma no Ko' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(resolveAnisongDB({ title: 'Akuma no Ko - From the First Take', artist: 'Unrelated cover artist' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });
  it('finds Red Swan TV Edit after removing its separated guest credit, without upgrading an unknown performer', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Red Swan', songArtist: 'YOSHIKI feat. HYDE', artists: [{ names: ['YOSHIKI'] }], animeENName: 'Attack on Titan Season 3' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'Red Swan - TV Edit - (feat. HYDE)', artist: 'YOSHIKI' })).resolves.toMatchObject([{ title: 'Attack on Titan Season 3', matchKind: 'version' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Red Swan' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(resolveAnisongDB({ title: 'Red Swan - TV Edit - (feat. HYDE)', artist: 'Unrelated cover artist' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });
  it('matches the unbracketed TV-size Kamikazari spelling to the verified catalog title', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Kami-kazari no Tenshi', songArtist: 'Megumi Nakajima', animeENName: 'Ascendance of a Bookworm', songType: 'Ending 1' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'Kamikazari No Tenshi TV size ver.', artist: 'Megumi Nakajima' })).resolves.toMatchObject([{ title: 'Ascendance of a Bookworm', matchKind: 'version', type: 'Ending 1' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Kami-kazari no Tenshi' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['Ai Kayano, 中津真莉子 & Natsumi Takamori', 'ペットな彼女たち', 'Ai Kayano, Mariko Nakatsu & Natsumi Takamori'])('resolves Japanese TV-size Sakurasou with verified group credit %s', async artist => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Kimi ga Yume o Tsuretekita', songArtist: 'Pet na Kanojo-tachi', animeENName: 'The Pet Girl of Sakurasou', songType: 'Opening 1' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: '君が夢を連れてきた(TVサイズ)', artist })).resolves.toMatchObject([{ title: 'The Pet Girl of Sakurasou', type: 'Opening 1', matchKind: 'version' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Kimi ga Yume o Tsuretekita' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not upgrade a solo member or incomplete lineup to the Sakurasou group', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Kimi ga Yume o Tsuretekita', songArtist: 'Pet na Kanojo-tachi' })])));
    for (const artist of ['Ai Kayano', 'Ai Kayano & Natsumi Takamori', 'Cover artist']) {
      await expect(resolveAnisongDB({ title: 'Kimi ga Yume o Tsuretekita (TVサイズ)', artist })).resolves.toMatchObject([{ matchKind: 'possible' }]);
    }
  });
  it.each(['初瀬いづな(CV:沢城みゆき)', '初瀬いづな（ＣＶ：沢城みゆき）', 'Miyuki Sawashiro'])('resolves Onegai Japanese character credit %s with one title request', async artist => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Onegai☆Snyaiper', songArtist: 'Miyuki Sawashiro', animeENName: 'No Game No Life', songType: 'Opening 2' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'おねがい☆すにゃいぱー', artist })).resolves.toMatchObject([{ title: 'No Game No Life', type: 'Opening 2', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Onegai☆Snyaiper' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not confirm Onegai with a different character voice credit or an unrelated song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Onegai☆Snyaiper', songArtist: 'Miyuki Sawashiro' })])));
    await expect(resolveAnisongDB({ title: 'Onegai☆Snyaiper', artist: '初瀬いづな(CV:Another actor)' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
    await expect(resolveAnisongDB({ title: 'Different song', artist: '初瀬いづな(CV:沢城みゆき)' })).resolves.toEqual([]);
  });
  it.each(['Reina Ueda', 'Ueda Reina', '上田麗奈'])('resolves the verified Japanese title with artist spelling %s in one request', async artist => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json([entry({ songName: 'Literature', songArtist: 'Reina Ueda', animeENName: 'Wandering Witch: The Journey of Elaina' })]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveAnisongDB({ title: 'リテラチュア', artist })).resolves.toMatchObject([{ title: 'Wandering Witch: The Journey of Elaina', matchKind: 'confirmed' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Literature' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recognizes Japanese and romanized Literature credits as versions without changing unrelated artists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Literature', songArtist: '上田麗奈' })])));
    await expect(resolveAnisongDB({ title: 'Riterachua (Instrumental)', artist: 'Reina Ueda' })).resolves.toMatchObject([{ matchKind: 'version' }]);
    await expect(resolveAnisongDB({ title: 'リテラチュア', artist: 'Unrelated artist' })).resolves.toEqual([]);
    await expect(resolveAnisongDB({ title: 'Different song', artist: '上田麗奈' })).resolves.toEqual([]);
  });
  it('posts a strict title query and returns a source-backed exact artist match with AniList id', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => { calls.push(init ?? {}); return json([entry()]); });
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toMatchObject([
      { id: 123, anilistId: 123, title: 'A Show', type: 'OP', matchKind: 'confirmed', sourceUrl: 'https://anisongdb.com/', evidence: expect.stringContaining('AnisongDB') },
    ]);
    expect(JSON.parse(String(calls[0]?.body))).toEqual({
      song_name_search_filter: { search: 'Theme', partial_match: false, match_case: false }, ignore_duplicate: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('uses MAL as a negative id when AniList ID is absent and validates identifiers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ linked_ids: { anilist: '9007199254740992', myanimelist: '456' } })])));
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toMatchObject([{ id: -456 }]);
  });

  it('classifies an artist-matched base title as a version and requests the stripped title', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => { calls.push(init ?? {}); return json([entry()]); });
    await expect(resolveAnisongDB({ title: 'Theme (Live)', artist: 'The Artist' })).resolves.toMatchObject([{ matchKind: 'version' }]);
    expect(JSON.parse(String(calls[0]?.body))).toMatchObject({ song_name_search_filter: { search: 'Theme' } });
  });

  it('accepts a verified artist alias from artists[].names', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songArtist: undefined, artists: [{ names: ['Alias Artist', 'The Artist'] }] })])));
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'Alias Artist' })).resolves.toMatchObject([{ matchKind: 'confirmed' }]);
  });

  it('allows exact-title possible results only when no confirmed match exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songArtist: 'Another Artist' })])));
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });

  it('suppresses possible collisions when a confirmed artist title is found in discovery', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(json([entry({ songArtist: 'Another Artist', linked_ids: { anilist: 1 } })]))
      .mockResolvedValueOnce(json([entry({ linked_ids: { anilist: 2 } })]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toMatchObject([{ id: 2, matchKind: 'confirmed' }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ artist_search_filter: { search: 'The Artist', partial_match: false, match_case: false }, ignore_duplicate: false });
  });

  it('does not pick an artist catalog song with a different title', async () => {
    const request = vi.fn().mockImplementation(() => json([entry({ songName: 'Different Song' })])).mockResolvedValueOnce(json([]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toEqual([]);
  });

  it('uses canonical title aliases when checking catalog titles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Yuki no Oto', songArtist: 'Novelbright', animeENName: 'Snow Show' })])));
    await expect(resolveAnisongDB({ title: '雪の音', artist: 'Novelbright' })).resolves.toMatchObject([{ title: 'Snow Show', matchKind: 'confirmed' }]);
  });

  it('discovers Novelbright Yuki no Ne after the canonical song-title search misses', async () => {
    const request = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([
      entry({ songName: 'Yuki no Ne', songArtist: 'Novelbright', animeENName: 'Yubisaki to Renren' }),
    ]));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: '雪の音', artist: 'Novelbright' })).resolves.toMatchObject([
      { title: 'Yubisaki to Renren', matchKind: 'confirmed' },
    ]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({ song_name_search_filter: { search: 'Yuki no Oto' } });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toMatchObject({ artist_search_filter: { search: 'Novelbright' } });
  });

  it('matches the exact artist alias on an instrumental as a version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([entry({ songName: 'Orange', songArtist: '7!!' })])));
    await expect(resolveAnisongDB({ title: 'Orange (Instrumental)', artist: 'seven oops' })).resolves.toMatchObject([
      { matchKind: 'version' },
    ]);
  });

  it('deduplicates anime IDs, prefers confirmed credits, and ignores invalid source IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([
      entry({ songArtist: 'Other Artist', linked_ids: { anilist: 7 } }),
      entry({ linked_ids: { anilist: 7 } }),
      entry({ linked_ids: { anilist: 'not-an-id', myanimelist: 0 } }),
    ])));
    const matches = await resolveAnisongDB({ title: 'Theme', artist: 'The Artist' });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: 7, matchKind: 'confirmed' });
  });

  it('keeps title-only possible evidence if the artist discovery request fails', async () => {
    const request = vi.fn().mockResolvedValueOnce(json([entry({ songArtist: 'Another Artist' })])).mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).resolves.toMatchObject([{ matchKind: 'possible' }]);
  });

  it('rejects malformed catalog payloads, reports HTTP errors, and times out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ result: [] })));
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).rejects.toThrow('AnisongDB returned an invalid response.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(resolveAnisongDB({ title: 'Theme', artist: 'The Artist' })).rejects.toThrow('AnisongDB is unavailable (HTTP 503).');

    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const pending = resolveAnisongDB({ title: 'Theme', artist: 'The Artist' });
    const assertion = expect(pending).rejects.toThrow('AnisongDB request timed out.');
    await vi.advanceTimersByTimeAsync(4_000);
    await assertion;

    vi.useRealTimers();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    const uncooperative = resolveAnisongDB({ title: 'Theme', artist: 'The Artist' });
    const uncooperativeAssertion = expect(uncooperative).rejects.toThrow('AnisongDB request timed out.');
    await vi.advanceTimersByTimeAsync(4_000);
    await uncooperativeAssertion;
  });

  it('propagates caller cancellation', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const pending = resolveAnisongDB({ title: 'Theme', artist: 'The Artist' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
