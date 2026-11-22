// Live metadata verification. No audio capture, uploads, API keys, or recognition credits.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('local-data', { recursive: true });
const bundle = path.resolve('local-data/verify-title-aliases.mjs');
await build({ entryPoints: ['src/providers/anime.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle });
const nativeFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  requests.push({ host: new URL(String(input)).host, status: response.status });
  return response;
};
const { resolveAnime } = await import(pathToFileURL(bundle).href);
const cases = [
  { title: 'スリピス', artist: '本田華子(CV:木野日菜), オリヴィア(CV:長江里加) & 野村香純(CV:小原好美)', expected: /Asobi Asobase/i },
  { title: 'Chikyugi - Spinning Globe', artist: 'Kenshi Yonezu', expected: /The Boy and the Heron/i },
  { title: 'Pino To Ameri (Anime Size)', artist: 'Huwie Ishizaki', expected: /Naruto/i, kind: 'version' },
  { title: '花咲み', artist: 'シルフィエット(CV:茅野愛衣)', expected: /Mushoku Tensei.*Season 2/i },
  { title: '終ワリノ歌', artist: 'Kenichiro Suehiro', expected: /Girls.? Last Tour/i },
  { title: '幻想の輪舞', artist: 'Maon Kurosaki', expected: /Grisaia.*Phantom Trigger/i },
  { title: 'TVアニメ「この素晴らしい世界に祝福を!」エンディング・テーマ「ちいさな冒険者 (TV-size)」', artist: 'Sora Amamiya, Rie Takahashi & Ai Kayano', expected: /KONOSUBA/i, kind: 'version' },
  { title: 'Tada Yowai Dakejanakute Bokurawa - NARUTO Syonenhen Version', artist: 'Mass Alert', expected: /Naruto/i, kind: 'version' },
  { title: 'Sound of Destiny (Live at Campus Fes) [TV Anime Ver.]', artist: 'Setsuna Ogiso (CV: Madoka Yonezawa)', expected: /White Album 2/i, kind: 'version' },
  { title: '夢路らびりんす', artist: 'らびりんず 千矢(CV.原田彩楓)&紺(CV.本渡 楓)&小梅(CV.久保ユリカ)&ノノ(CV.佳村はるか)', expected: /Urara Meirocho/i },
  { title: 'LOVE 2000', artist: 'Anna Yanami (CV: Hikaru Tono)', expected: /Makeine/i },
  { title: 'STEEL', artist: 'TRUE', expected: /Iron.Blooded Orphans/i },
  { title: "After All Tsuduru Omoi '13", artist: 'Rena Uehara', expected: /White Album 2/i },
  { title: '夏を見ていた～「蛍火の杜へ」エンディングテーマ', artist: 'Sizzle Ohtaka', expected: /Forest of Fireflies|Firefly Forest|Hotarubi/i },
  { title: 'Wrong World', artist: 'TOGENASHI TOGEARI', expected: /Girls Band Cry/i },
  { title: 'はじまりの場所', artist: 'Rie Murakawa', expected: /Forest of Piano|Piano no Mori/i },
  { title: 'ベラフの子守歌', artist: 'Kevin Penkin', expected: /Made in Abyss.*Golden City/i },
  { title: 'Anone', artist: 'Yuna (CV: Maki Kawase)', expected: /Kuma Kuma Kuma Bear/i },
  { title: 'Lullaby In the Peaceful Light', artist: 'Masakatsu Takagi', expected: /Wolf Children/i },
  { title: 'Comedy', artist: 'Gen Hoshino', expected: /Spy.*Family/i },
  { title: 'The secret of happiness', artist: 'Akane Kumada', expected: /7th Prince/i },
  { title: 'Rhapsody of Blue Sky', artist: 'Fhána', expected: /Kobayashi.*Dragon Maid/i },
  { title: '瞳ニ映ル景色', artist: 'Kenichirou Suehiro', expected: /Girls.? Last Tour/i },
  { title: 'インキャインパルス (feat. Ikepy & KSKN)', artist: '本田華子(CV:木野日菜), オリヴィア(CV:長江里加), 野村香純(CV:小原好美) feat. Ikepy & KSKN', expected: /Asobi Asobase/i },
  { title: 'Hengen Jizaino Majikaru Star', artist: 'GRANRODEO', expected: /Kuroko/i },
];
const observations = [];
for (const { expected, kind = 'confirmed', ...song } of cases) {
  requests = [];
  const start = performance.now();
  try {
    const matches = await resolveAnime(song);
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: matches.some(match => expected.test(match.title) && match.matchKind === kind), requests, matches });
  } catch (error) {
    observations.push({ song, elapsedMs: Math.round(performance.now() - start), passed: false, requests, error: String(error) });
  }
}
const report = { date: new Date().toISOString(), scope: 'Live full anime resolver with screenshot metadata; does not test audio recognition.', observations };
await writeFile('docs/TITLE_ALIAS_LIVE_RESULTS.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (observations.some(item => !item.passed)) process.exitCode = 1;
