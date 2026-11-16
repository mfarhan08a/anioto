import { afterEach, describe, expect, it, vi } from 'vitest';
import { recognize } from '../src/providers/audiotag';
import { clearAnimeCache, resolveAnime } from '../src/providers/animethemes';
import { baseRecordingTitle, withoutFeaturedCredit } from '../src/providers/song-titles';
import { canonicalTitleFor } from '../src/providers/title-aliases';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
afterEach(() => { clearAnimeCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function recognizeWithPoll(pollResult: unknown) {
  const calls: FormData[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = init.body as FormData;
    calls.push(body);
    if (body.get('action') === 'stat') return json({ success: true, identification_free_sec_remainder: 30 });
    if (body.get('action') === 'identify') return json({ success: true, token: 'opaque' });
    return json(pollResult);
  }));
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: TimerHandler, ms?: number) => {
    if (ms === 2_000) { if (typeof cb === 'function') queueMicrotask(cb as () => void); return 1 as never; }
    return realSetTimeout(cb, ms);
  }) as typeof setTimeout);
  return { calls, promise: recognize(new Blob(['audio']), 'key', new AbortController().signal) };
}

describe('AudioTag recognition', () => {
  it('checks free quota before identify, polls, and parses track tuple rows', async () => {
    const { calls, promise } = recognizeWithPoll({ success: true, result: 'found', data: [{ confidence: 99, time: [], tracks: [['Song', 'Artist', 'Album', 2000]] }] });
    await expect(promise).resolves.toEqual([{ title: 'Song', artist: 'Artist', album: 'Album' }]);
    expect(calls.map(call => call.get('action'))).toEqual(['stat', 'identify', 'get_result']);
    expect(calls[2]!.get('token')).toBe('opaque');
    expect((calls[1]!.get('file') as File).name).toBe('sample.wav');
    expect(calls[1]!.get('time_len')).toBe('15');
    expect(calls[1]!.get('start_time')).toBe('0');
  });

  it('reports no match only for the explicit not found status', async () => {
    const { promise } = recognizeWithPoll({ success: true, result: 'not found' });
    await expect(promise).resolves.toEqual([]);
  });

  it('reports malformed found details as an error instead of a no-match', async () => {
    const { promise } = recognizeWithPoll({ success: true, result: 'found', data: [{ confidence: 99, tracks: [['', null]] }] });
    await expect(promise).rejects.toThrow('AudioTag reported a match, but its track details could not be read.');
  });

  it('rejects poll responses without success true', async () => {
    const { promise } = recognizeWithPoll({ result: 'not found' });
    await expect(promise).rejects.toThrow('AudioTag returned an invalid identification result');
  });

  it('fails closed without enough known free quota and never starts a paid request', async () => {
    const fetchMock = vi.fn(async () => json({ success: true, identification_free_sec_remainder: 14 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recognize(new Blob(['audio']), 'key', new AbortController().signal)).rejects.toThrow(/free allowance/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not identify if the quota field is missing', async () => {
    const fetchMock = vi.fn(async () => json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recognize(new Blob(), 'key', new AbortController().signal)).rejects.toThrow(/free allowance/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('AnimeThemes matching', () => {
  it.each(['Akane Sasu (instrumental)', '茜さす（instrumental）'])('maps Aimer instrumental metadata %s to the catalog title', async (title) => {
    const queried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        queried.push(url.searchParams.get('filter[title-like]') ?? '');
        return json({ songs: [{
          id: 20, title: 'Akane Sasu', artists: [{ name: 'Aimer' }],
          animethemes: [{ type: 'ED', anime: { id: 21, name: 'Natsume’s Book of Friends Season 5', slug: 'natsume_yuujinchou_go' } }],
        }] });
      }
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title, artist: 'Aimer', album: '茜さす / everlasting snow' })).resolves.toMatchObject([
      { id: 21, matchKind: 'version', type: 'ED' },
    ]);
    expect(queried).toEqual(['Akane Sasu']);
  });

  it('shows Orange from a credited source as possible for an edit-title recognition', async () => {
    const queried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        queried.push(url.searchParams.get('filter[title-like]') ?? '');
        return json({ songs: [
          { id: 7, title: 'Orange', artists: [{ name: '7!!' }], animethemes: [{ type: 'ED', anime: { id: 22, name: 'Your Lie in April', slug: 'shigatsu_wa_kimi_no_uso' } }] },
          { id: 8, title: 'Orange', artists: [{ name: 'Unrelated Artist' }], animethemes: [{ type: 'ED', anime: { id: 23, name: 'Unrelated Show', slug: 'unrelated_show' } }] },
        ] });
      }
      return json({ anime: { resources: [] } });
    }));

    const matches = await resolveAnime({ title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' });
    expect(matches).toHaveLength(2);
    expect(matches).toMatchObject([
      { id: 22, title: 'Your Lie in April', matchKind: 'possible', evidence: expect.stringContaining('7!!') },
      { id: 23, title: 'Unrelated Show', matchKind: 'possible', evidence: expect.stringContaining('Unrelated Artist') },
    ]);
    expect(queried).toEqual(['Orange']);
  });

  it.each([
    ['Akane Sasu (instrumental)', 'Akane Sasu'],
    ['Akane Sasu [INSTRUMENTAL.]', 'Akane Sasu'],
    ['茜さす（instrumental）', '茜さす'],
    ['Akane Sasu (Off Vocal)', 'Akane Sasu'],
    ['Akane Sasu - Off-vocal Ver.', 'Akane Sasu'],
    ['Akane Sasu (KARAOKE)', 'Akane Sasu'],
    ['Akane Sasu (TV-size)', 'Akane Sasu'],
    ['Kamikazari No Tenshi TV size ver.', 'Kamikazari No Tenshi'],
    ['Theme (TV size ver.)', 'Theme'],
    ['Theme TV-size version', 'Theme'],
    ['Theme TVサイズ ver.', 'Theme'],
    ['Red Swan - TV Edit - (feat. HYDE)', 'Red Swan'],
    ['Red Swan (TV Edit) [ft. HYDE]', 'Red Swan'],
    ['Red Swan TV Edit', 'Red Swan'],
    ['Red Swan – TV Edit – (feat. HYDE)', 'Red Swan'],
    ['Akuma no Ko - From the First Take', 'Akuma no Ko'],
    ['Akuma no Ko (From THE FIRST TAKE)', 'Akuma no Ko'],
    ['Akuma no Ko [THE FIRST TAKE]', 'Akuma no Ko'],
    ['Theme - From THE FIRST TAKE (feat. Guest)', 'Theme'],
    ['君が夢を連れてきた(TVサイズ)', '君が夢を連れてきた'],
    ['君が夢を連れてきた（ＴＶサイズ）', '君が夢を連れてきた'],
    ['Theme [TV サイズ]', 'Theme'],
    ['Akane Sasu [TV Ver.]', 'Akane Sasu'],
    ['Orange (Underwater)', 'Orange'],
    ['Orange [UNDERWATER]', 'Orange'],
    ['Orange - Underwater Version', 'Orange'],
    ['Orange (Slowed + Reverb)', 'Orange'],
    ['Orange [Slowed/Reverb]', 'Orange'],
    ['Orange - Slowed & Reverb', 'Orange'],
    ['Orange (Sped Up)', 'Orange'],
    ['Orange [Nightcore]', 'Orange'],
  ])('strips explicit arrangement suffix %s', (input, expected) => {
    expect(baseRecordingTitle(input)).toBe(expected);
  });

  it.each(['From the First Take', 'My First Take', 'Theme - From the First Take Tonight', 'Instrumental', 'Love Karaoke', 'TV Size', 'TV size ver.', 'TV Edit', 'Love TV Edit Story', 'Theme TV size story', 'Theme Live', 'Off Vocal', 'Underwater', 'Nightcore', 'Sped Up'])('preserves meaningful title %s', input => {
    expect(baseRecordingTitle(input)).toBeUndefined();
  });

  it('removes a guest-credit separator only together with an explicit guest credit', () => {
    expect(withoutFeaturedCredit('Red Swan - TV Edit - (feat. HYDE)')).toBe('Red Swan - TV Edit');
    expect(withoutFeaturedCredit('Red Swan - (feat. HYDE)')).toBe('Red Swan');
    expect(withoutFeaturedCredit('Title -')).toBe('Title -');
    expect(withoutFeaturedCredit('Title - (A Story)')).toBe('Title - (A Story)');
  });

  it('canonicalizes the verified Japanese title only for Novelbright and still requires a live AnimeThemes match', async () => {
    const queried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        queried.push(url.searchParams.get('filter[title-like]') ?? '');
        return json({ songs: [{
          title: 'Yuki no Oto', artists: [{ name: 'Novelbright' }],
          animethemes: [{ type: 'OP', anime: { id: 4209, name: 'Yubisaki to Renren', slug: 'yubisaki_to_renren' } }],
        }] });
      }
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: '雪の音', artist: 'Novelbright' })).resolves.toMatchObject([
      { id: 4209, title: 'Yubisaki to Renren', type: 'OP', sourceUrl: 'https://animethemes.moe/anime/yubisaki_to_renren' },
    ]);
    expect(queried).toEqual(['Yuki no Oto']);
    expect(canonicalTitleFor('Yukinone', 'Novelbright')).toBe('Yuki no Oto');
    expect(canonicalTitleFor('Sound of Snow', 'Novelbright')).toBe('Yuki no Oto');
  });

  it('does not apply a title alias to another artist', async () => {
    const queried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      queried.push(url.searchParams.get('filter[title-like]') ?? '');
      return json({ songs: [] });
    }));

    await expect(resolveAnime({ title: '雪の音', artist: 'Another Artist' })).resolves.toEqual([]);
    expect(canonicalTitleFor('雪の音', 'Another Artist')).toBe('雪の音');
    expect(queried).toEqual(['雪の音']);
  });

  it('does not synthesize an anime association if the canonical title query returns no AnimeThemes song', async () => {
    const queried: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      queried.push(url.searchParams.get('filter[title-like]') ?? '');
      return json({ songs: [] });
    }));

    await expect(resolveAnime({ title: 'Yukinone', artist: 'Novelbright' })).resolves.toEqual([]);
    expect(queried).toEqual(['Yuki no Oto']);
  });

  it('enriches a documented theme using its numeric AniList resource', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/song?')) return json({ songs: [{ title: 'Theme', artists: [{ name: 'Artist' }], animethemes: [{type:'OP',anime:{id:1,name:'Original',slug:'original'}}] }] });
      if (url.includes('/anime/original?')) return json({anime:{resources:[{site:'AniList',external_id:123}]}});
      return json({data:{Media:{title:{english:'English title',romaji:'Original'},coverImage:{large:'https://example.com/cover.jpg'}}}});
    }));
    await expect(resolveAnime({title:'Theme',artist:'Artist'})).resolves.toMatchObject([{title:'English title',romajiTitle:'Original',coverUrl:'https://example.com/cover.jpg',type:'OP'}]);
  });

  it('retains documented evidence if optional anime enrichment fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/song?')) return json({songs:[{title:'Theme',artists:[{name:'Artist'}],animethemes:[{type:'ED',anime:{id:2,name:'Original title',slug:'original'}}]}]});
      throw new TypeError('metadata offline');
    }));
    await expect(resolveAnime({title:'Theme',artist:'Artist'})).resolves.toMatchObject([{title:'Original title',type:'ED'}]);
  });
  it('returns anime only when both normalized title and artist credit match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: [
      { title: 'Blue Bird', artists: [{ name: 'Ikimono-gakari' }], animethemes: [{ type: 'OP', anime: { id: 1, name: 'Right Show', slug: 'right-show', resources: [] } }] },
      { title: 'Blue Bird', artists: [{ name: 'Someone Else' }], animethemes: [{ anime: { id: 2, name: 'Wrong Artist', slug: 'wrong-artist', resources: [] } }] },
      { title: 'Blue Bird (Cover)', artists: [{ name: 'Ikimono-gakari' }], animethemes: [{ anime: { id: 3, name: 'Wrong Song', slug: 'wrong-song', resources: [] } }] },
    ] })));
    const matches = await resolveAnime({ title: 'Blue Bird', artist: 'Ikimono-gakari' });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: 1, title: 'Right Show', type: 'OP', sourceUrl: 'https://animethemes.moe/anime/right-show' });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/song?');
  });

  it('finds an artist-matched base song for a recognized live recording title', async () => {
    const queries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        const query = url.searchParams.get('filter[title-like]') ?? '';
        queries.push(query);
        return json({ songs: query === 'Sign' ? [{
          id: 1, title: 'Sign', artists: [{ name: 'FLOW' }],
          animethemes: [{ type: 'OP', anime: { id: 7, name: 'Naruto Shippuden', slug: 'naruto_shippuden' } }],
        }] : [] });
      }
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'Sign (Live)', artist: 'FLOW' })).resolves.toMatchObject([
      { id: 7, matchKind: 'version', evidence: expect.stringContaining('recording of “Sign”'), type: 'OP' },
    ]);
    expect(queries).toEqual(['Sign']);
  });

  it('strips a recognized remaster suffix without matching a title fragment', async () => {
    const queries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        const query = url.searchParams.get('filter[title-like]') ?? '';
        queries.push(query);
        return json({ songs: query === 'Theme' ? [{
          id: 4, title: 'Theme', artists: [{ name: 'Artist' }],
          animethemes: [{ anime: { id: 10, name: 'Show', slug: 'show' } }],
        }] : [] });
      }
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'Theme - Remastered', artist: 'Artist' })).resolves.toMatchObject([
      { id: 10, matchKind: 'version' },
    ]);
    expect(queries).toEqual(['Theme']);
  });

  it('labels an exact base-title hit with a different credited performer as possible', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') return json({ songs: url.searchParams.get('filter[title-like]') === 'Song'
        ? [{ id: 2, title: 'Song', artists: [{ name: 'Original Artist' }], animethemes: [{ anime: { id: 8, name: 'Original Anime', slug: 'original_anime' } }] }]
        : [] });
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'Song (Cover)', artist: 'Cover Performer' })).resolves.toMatchObject([
      { id: 8, matchKind: 'possible', evidence: expect.stringContaining('Original Artist') },
    ]);
  });

  it('labels a bare exact title with a different credited performer as possible', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') return json({ songs: [{
        id: 11, title: 'unravel', artists: [{ name: 'TK from Ling tosite sigure' }],
        animethemes: [{ anime: { id: 12, name: 'Tokyo Ghoul', slug: 'tokyo_ghoul' } }],
      }] });
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'unravel', artist: 'Cover Performer' })).resolves.toMatchObject([
      { id: 12, matchKind: 'possible', evidence: expect.stringContaining('TK from Ling tosite sigure') },
    ]);
  });

  it('returns exact-title possible collisions when no artist-confirmed match exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: [
      { id: 13, title: 'Theme', artists: [{ name: 'Source Artist A' }], animethemes: [{ anime: { id: 14, name: 'Show A', slug: 'show_a' } }] },
      { id: 15, title: 'Theme', artists: [{ name: 'Source Artist B' }], animethemes: [{ anime: { id: 16, name: 'Show B', slug: 'show_b' } }] },
    ] })));

    const matches = await resolveAnime({ title: 'Theme', artist: 'Cover Artist' });
    expect(matches).toHaveLength(2);
    expect(matches).toMatchObject([
      { id: 14, matchKind: 'possible', evidence: expect.stringContaining('Source Artist A') },
      { id: 16, matchKind: 'possible', evidence: expect.stringContaining('Source Artist B') },
    ]);
  });

  it('canonicalizes the stripped base title after a recording suffix', async () => {
    const queries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') {
        const query = url.searchParams.get('filter[title-like]') ?? '';
        queries.push(query);
        return json({ songs: query === 'Yuki no Oto' ? [{
          id: 17, title: 'Yuki no Oto', artists: [{ name: 'Novelbright' }],
          animethemes: [{ anime: { id: 18, name: 'Show', slug: 'show' } }],
        }] : [] });
      }
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'Sound of Snow (Live)', artist: 'Novelbright' })).resolves.toMatchObject([
      { id: 18, matchKind: 'version' },
    ]);
    expect(queries).toEqual(['Yuki no Oto']);
  });

  it('strips bounded live-at, piano-version, and remaster-year suffixes', async () => {
    for (const [inputTitle, expectedBase] of [
      ['Theme (Live at Tokyo Dome)', 'Theme'],
      ['Theme - Live at Tokyo Dome', 'Theme'],
      ['Theme (Piano Version)', 'Theme'],
      ['Theme (Acoustic Ver.)', 'Theme'],
      ['Theme (Remastered 2020)', 'Theme'],
    ] as const) {
      const queries: string[] = [];
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        queries.push(url.searchParams.get('filter[title-like]') ?? '');
        return json({ songs: [] });
      }));
      await expect(resolveAnime({ title: inputTitle, artist: 'Artist' })).resolves.toEqual([]);
      expect(queries).toEqual([expectedBase]);
    }
  });

  it('does not treat substring title collisions as base-song matches', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/song') return json({ songs: [{
        id: 3, title: 'Blue Bird Reprise', artists: [{ name: 'Original Artist' }],
        animethemes: [{ anime: { id: 9, name: 'Unrelated', slug: 'unrelated' } }],
      }] });
      return json({ anime: { resources: [] } });
    }));

    await expect(resolveAnime({ title: 'Blue Bird (Live)', artist: 'Cover Performer' })).resolves.toEqual([]);
  });

  it('treats a malformed fallback response as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.searchParams.get('filter[title-like]') === 'Song' ? json({ result: [] }) : json({ songs: [] });
    }));

    await expect(resolveAnime({ title: 'Song (Acoustic)', artist: 'Artist' })).rejects.toThrow('AnimeThemes returned an invalid response.');
  });

  it('returns no fabricated association when the response contains no exact credited theme', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ songs: [] })));
    await expect(resolveAnime({ title: 'Unlisted track', artist: 'Unknown artist' })).resolves.toEqual([]);
  });

  it('resolves a reviewed featured song even if the OP/ED catalog is offline', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', request);
    await expect(resolveAnime({ title: 'I Really Want to Stay At Your House', artist: 'Rosa Walton & Hallie Coggins' })).resolves.toMatchObject([{ title: 'Cyberpunk: Edgerunners', type: 'Featured song', matchKind: 'confirmed' }]);
    expect(request).not.toHaveBeenCalled();
  });

  it('reports HTTP and network failures instead of mislabeling them as no match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(resolveAnime({ title: 'Track', artist: 'Artist' })).rejects.toThrow('AnimeThemes is unavailable.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(resolveAnime({ title: 'Track', artist: 'Artist' })).rejects.toThrow('AnimeThemes is unavailable (HTTP 503).');
  });

  it('reports invalid API payloads instead of treating them as an empty catalog result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ result: [] })));
    await expect(resolveAnime({ title: 'Track', artist: 'Artist' })).rejects.toThrow('AnimeThemes returned an invalid response.');
  });

  it('reports AnimeThemes timeout distinctly from an explicit empty search', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const pending = resolveAnime({ title: 'Track', artist: 'Artist' });
    const timeoutAssertion = expect(pending).rejects.toThrow('AnimeThemes request timed out.');
    await vi.advanceTimersByTimeAsync(25_000);
    await timeoutAssertion;
  });

  it('propagates user cancellation', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const pending = resolveAnime({ title: 'Track', artist: 'Artist' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

it('keeps Japanese instrumental aliases artist-specific', () => { expect(canonicalTitleFor(baseRecordingTitle('茜さす（instrumental）')!, 'Aimer')).toBe('Akane Sasu'); expect(canonicalTitleFor('茜さす', 'Other Artist')).toBe('茜さす'); });

it('accepts the documented seven oops/7!! artist alias without upgrading an unrelated cover artist', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('/song?')
    ? json({ songs: [{ id: 10, title: 'Orange', artists: [{ name: '7!!' }], animethemes: [{ type: 'ED', anime: { id: 9, name: 'Shigatsu wa Kimi no Uso', slug: 'shigatsu_wa_kimi_no_uso' } }] }] })
    : json({ anime: { resources: [] } })));
  await expect(resolveAnime({ title: 'Orange (Instrumental)', artist: 'seven oops' })).resolves.toMatchObject([{ id: 9, matchKind: 'version' }]);
  await expect(resolveAnime({ title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' })).resolves.toMatchObject([{ id: 9, matchKind: 'possible' }]);
  expect(canonicalTitleFor('オレンジ', 'seven oops')).toBe('Orange');
  expect(canonicalTitleFor('オレンジ', 'Unknown performer')).toBe('オレンジ');
});

it('ranks a documented release reference without guessing the original recording performer', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('/song?')
    ? json({ songs: [
      { id: 11, title: 'Orange', artists: [{ name: 'Unrelated artist' }], animethemes: [{ anime: { id: 10, name: 'Other show', slug: 'other_show' } }] },
      { id: 12, title: 'Orange', artists: [{ name: 'Seven Oops' }], animethemes: [{ type: 'ED', anime: { id: 2583, name: 'Shigatsu wa Kimi no Uso', slug: 'shigatsu_wa_kimi_no_uso' } }] },
    ] }) : json({ anime: { resources: [] } })));
  const matches = await resolveAnime({ title: 'Orange (Underwater)', artist: 'Kaori Miyazono & Zero Two' });
  expect(matches).toHaveLength(2);
  expect(matches[0]).toMatchObject({ id: 2583, matchKind: 'possible', recordingReferenceUrl: 'https://open.spotify.com/track/50kfguKW1syfBC7YslSvfu' });
  expect(matches[0]!.evidence).toContain('not an original-performer match');
  const unrelated = await resolveAnime({ title: 'Orange (Underwater)', artist: 'Another cover artist' });
  expect(unrelated[0]).toMatchObject({ id: 10 });
  expect(unrelated.some(value => value.recordingReferenceUrl)).toBe(false);
});
