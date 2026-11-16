import { normalizeSongText } from './song-titles';
import { ALYA_KAF_DUET, ALYA_SOLO } from './alya-song-credits';

export const INFINITE_STRATOS_2_ENDING_CAST = 'Yoko Hikasa, Yukana, Asami Shimoda, Kana Hanazawa, Marina Inoue, Suzuko Mimori, Chiwa Saito';
export const CARNIVAL_PHANTASM_OPENING_CAST = 'Minami Kuribayashi, Miyuki Hashimoto, Faylan, Aki Misato, yozuca*, rino';

// The official anime credit names 7!! (seven oops / セブンウップス):
// https://www.kimiuso.jp/music/04.html and https://7oops.com/
const GROUPS = [
  // https://www.kadokawa.co.jp/product/video1107/
  ['Noriko Watanabe', 'Watanabe Noriko', '渡辺典子', '渡辺 典子'],
  // https://www.typemoon.com/products/cp/outline.html
  [CARNIVAL_PHANTASM_OPENING_CAST, 'Minami Kuribayashi, Hashimoto Miyuki, Faylan, Aki Misato, yozuca* & Rino',
    '栗林みな実、橋本みゆき、飛蘭、美郷あき、yozuca*、rino'],
  // https://king-cr.jp/artist/takahashi/discography/
  ['Yoko Takahashi', 'Takahashi Yoko', '高橋洋子', '高橋 洋子'],
  // https://columbia.jp/prod-info/COCX-35798/
  ['Aya Hirano', 'Hirano Aya', '平野綾', '平野 綾', 'デンデ (CV:平野 綾)', 'デンデ (CV:平野綾)', 'Dende (CV: Aya Hirano)'],
  // https://mahoako-anime.com/index.html and https://music.apple.com/us/song/1733426741
  ['Yuuka Aisaka', 'Yuka Aisaka', 'Aisaka Yuuka', '相坂優歌', 'Loco Musica (CV: Yuuka Aisaka)', 'ロコムジカ(CV:相坂優歌)'],
  ['IOSYS jk Girls', 'イオシスjkガールズ'],
  ['Shion Miyawaki', 'Miyawaki Shion', '宮脇詩音'],
  // https://columbia.jp/prod-info/COZC-1385-6/
  ['pua:re', 'Puare', 'ピュアレ'],
  // https://columbia.jp/prod-info/COCX-38577/
  ['Minori Chihara', 'Chihara Minori', '茅原実里', 'Miku Izayoi (CV: Minori Chihara)', '誘宵美九(CV:茅原実里)'],
  ALYA_SOLO,
  ALYA_KAF_DUET,
  // https://bclover.jp/season1/news/detail.php?id=1065606
  ['Megumi Han', '潘めぐみ', 'KAHONO(cv.潘めぐみ)', 'カホノ(cv.潘めぐみ)'],
  // https://www.symphogear.com/sound.html
  ['Aoi Yuki', 'Yuki Aoi', '悠木碧', '悠木 碧', '立花響(CV:悠木碧)', '立花 響(CV:悠木 碧)'],
  // https://columbia.jp/prod-info/COCC-16319/
  ['Mayumi Gojo', 'Mayumi Gojou', 'Mayumi Gojō', '五條真由美'],
  ['Yorushika', 'ヨルシカ'],
  // https://hanayamata.com/discography/detail.php?id=1008379
  ['Team "Hanayamata"', 'チーム“ハナヤマタ”'],
  // Official Japanese credit: https://kotenbu.com/goods/cd_op2.html
  // AnisongDB credits Mikansei Stride to the Latin spelling Saori Codama.
  ['Saori Kodama', 'Saori Codama', 'こだまさおり'],
  ['7!!', 'seven oops', '7oops', 'セブンウップス'],
  // Official Japanese/Latin artist identity: https://www.lantis.jp/news.php?id=1595505597
  // and https://reinaueda.lantis.jp/
  ['Reina Ueda', 'Ueda Reina', '上田麗奈'],
  // https://www.jvcmusic.co.jp/flyingdog/-/Discography/A021733/VTCL-35309.html
  // https://www.jvcmusic.co.jp/flyingdog/-/Discography/A008451/VTCL-60061.html
  ['Megumi Nakajima', 'Nakajima Megumi', '中島愛', '中島 愛', 'Ranka Lee = Megumi Nakajima', 'ランカ・リー＝中島 愛', 'ランカ・リー＝中島愛'],
  // Exact character/voice credit, not an arbitrary character-name inference:
  // https://ngnl.jp/staff-cast/ and https://open.spotify.com/track/0bRaIPC9P0Uz4oVD3QW5kr
  ['Miyuki Sawashiro', 'Sawashiro Miyuki', '沢城みゆき', '初瀬いづな(CV:沢城みゆき)'],
  // The complete trio is the credited group; a solo member is not equivalent.
  // https://sakurasou.tv/news/archives/120903_oped.html
  ['Pet na Kanojo-tachi', 'ペットな彼女たち', 'Ai Kayano, 中津真莉子 & Natsumi Takamori',
    'Ai Kayano, Mariko Nakatsu & Natsumi Takamori', '茅野愛衣、中津真莉子、高森奈津美'],
  // TBS credits seven performers. AnisongDB lists shorter lineups separately.
  // https://www.tbs.co.jp/anime/is2/news/news1310.html
  [INFINITE_STRATOS_2_ENDING_CAST,
    'シャルロット・デュノア(CV.花澤香菜), セシリア・オルコット(CV.ゆかな), ラウラ・ボーデヴィッヒ(CV.井上麻里奈), 凰鈴音(CV.下田麻美), 更識楯無(CV.斎藤千和), 更識簪(CV.三森すずこ) & 篠ノ之箒(CV.日笠陽子)',
    '篠ノ之箒(CV.日笠陽子), セシリア・オルコット(CV.ゆかな), 凰鈴音(CV.下田麻美), シャルロット・デュノア(CV.花澤香菜), ラウラ・ボーデヴィッヒ(CV.井上麻里奈), 更識楯無(CV.斎藤千和), 更識簪(CV.三森すずこ)'],
] as const;

/** Alias equivalence is explicit; an arbitrary cover artist never becomes the original artist. */
export function canonicalArtist(value: string): string {
  const normalized = normalizeSongText(value);
  const group = GROUPS.find(names => names.some(name => normalizeSongText(name) === normalized));
  return group ? normalizeSongText(group[0]) : normalized;
}
