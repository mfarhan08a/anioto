/** Evidence-backed title aliases. Add an alias only with an artist-specific primary source. */
import { canonicalArtist, CARNIVAL_PHANTASM_OPENING_CAST } from './artist-aliases';
import { ALYA_SONG_CREDITS } from './alya-song-credits';
import { baseRecordingTitle, normalizeSongText, withoutAnimeCredit, withoutFeaturedCredit } from './song-titles';
export interface VerifiedTitleAlias {
  artist: string;
  artistAliases?: readonly string[];
  canonicalTitle: string;
  aliases: readonly string[];
  /** Reviewed song nicknames usable for discovery; never imply performer equivalence. */
  titleOnlyAliases?: readonly string[];
  recordingAliases?: readonly string[];
  evidence: readonly string[];
}

export const VERIFIED_TITLE_ALIASES: readonly VerifiedTitleAlias[] = [
  {
    artist: 'Lia',
    artistAliases: ['VISUAL ARTS / Key', 'Lia & VISUAL ARTS / Key'],
    canonicalTitle: 'Toki o Kizamu Uta',
    aliases: ['Toki o Kizamu Uta', 'Toki wo Kizamu Uta', '時を刻む唄'],
    evidence: ['https://linkco.re/uPM7YCgu?lang=en'],
  },
  {
    artist: 'Konomi Kohara',
    canonicalTitle: 'Chikatto Chika Chika♡',
    aliases: ['Chikatto Chika Chika♡', 'チカっとチカ千花っ♡'],
    titleOnlyAliases: ['Chika Dance'],
    evidence: ['https://kaguya.love/1st/goods/?item_id=4671', 'https://www.hobby-wave.com/products/dt170/', 'https://anisongdb.com/'],
  },
  {
    artist: 'fhána',
    canonicalTitle: 'Ai no Supreme!',
    aliases: ['Ai no Supreme!', 'Love Supreme!', '愛のシュプリーム！'],
    evidence: ['https://www.youtube.com/watch?v=xiCdLC6bWU4', 'https://maidragon.jp/2nd/special/interview_fhana-elma/'],
  },
  {
    artist: 'Hana Hope',
    canonicalTitle: 'Tabi no Yukue',
    aliases: ['Tabi no Yukue', 'Destination of the journey', '旅のゆくえ'],
    evidence: ['https://www.youtube.com/watch?v=PGB9L8TnvNE', 'https://spice-and-wolf.com/special/specialinterview_op.html'],
  },
  {
    artist: 'Yuiko Ohara',
    canonicalTitle: 'Mezame no Uta',
    aliases: ['Mezame no Uta', '目覚めの唄'],
    evidence: ['https://mushokutensei.jp/music/', 'https://mushokutensei.jp/news/210924-1/'],
  },
  {
    artist: 'Yoshino Aoyama',
    artistAliases: ['Hitori Gotoh', '後藤ひとり'],
    canonicalTitle: 'Oshiire yori Ai o Komete',
    aliases: ['Oshiire yori Ai o Komete', 'With love from the closet', '押入れより愛をこめて'],
    evidence: ['https://www.youtube.com/watch?v=sPQ7t7lzBQI', 'https://anisongdb.com/'],
  },
  {
    artist: 'Ainz Ooal Gown Gasshou-dan',
    artistAliases: ['Syuji Katayama', 'Shuji Katayama', '片山修志'],
    canonicalTitle: 'Ware koso ga Ainz Ooal Gown',
    aliases: ['Ware koso ga Ainz Ooal Gown', '我こそがアインズ・ウール・ゴウン'],
    evidence: ['https://store.kadokawa.co.jp/shop/g/g4935228173211/', 'https://anisongdb.com/'],
  },
  {
    artist: 'Rie Murakawa',
    canonicalTitle: 'Hajimari no Basho',
    aliases: ['Hajimari no Basho', 'はじまりの場所'],
    evidence: ['https://columbia.jp/artist-info/murakawarie/discography/COCC-17555.html'],
  },
  {
    artist: 'Mitsuki Saiga',
    // The OST release is credited to its composer; this is not a global artist equivalence.
    artistAliases: ['Kevin Penkin', 'ベラフ(CV:斎賀みつき)'],
    canonicalTitle: 'Belaf no Komoriuta',
    aliases: ['Belaf no Komoriuta', 'ベラフの子守歌', "Belaf's Lullaby"],
    evidence: ['https://miabyss.com/2nd_music_ost.html', 'https://www.youtube.com/watch?v=BCBcTjDEnmM', 'https://anisongdb.com/'],
  },
  {
    artist: 'Maki Kawase',
    artistAliases: ['Yuna (CV: Maki Kawase)', 'ユナ(CV:河瀬茉希)'],
    canonicalTitle: 'Ano ne.',
    aliases: ['Ano ne.', 'Anone', 'あのね。'],
    evidence: ['https://columbia.jp/prod-info/COCC-17809/'],
  },
  {
    artist: 'Masakatsu Takagi',
    canonicalTitle: 'Hidamari no Mori Uta',
    aliases: ['Hidamari no Mori Uta', 'Lullaby In the Peaceful Light', '陽だまりの守唄'],
    evidence: ['https://www.youtube.com/watch?v=8oaYiL_JQaI', 'https://anisongdb.com/'],
  },
  {
    artist: 'Gen Hoshino',
    canonicalTitle: 'Kigeki',
    aliases: ['Kigeki', 'Comedy', '喜劇'],
    evidence: ['https://www.hoshinogen.com/works/detail/?id=39'],
  },
  {
    artist: 'Akane Kumada',
    canonicalTitle: 'Happy no Hiketsu',
    aliases: ['Happy no Hiketsu', 'The secret of happiness', 'ハッピーの秘訣'],
    evidence: ['https://www.youtube.com/watch?v=DiDDWexFjmg', 'https://www.youtube.com/watch?v=AQYoAXuHqzE'],
  },
  {
    artist: 'fhána',
    canonicalTitle: 'Aozora no Rhapsody',
    aliases: ['Aozora no Rhapsody', 'Rhapsody of Blue Sky', '青空のラプソディ'],
    evidence: ['https://fhana.jp/works/', 'https://www.lantis.jp/artist/fhana/news_1482462002.html'],
  },
  {
    artist: 'MAYUKO & Luminous',
    artistAliases: ['Kenichirou Suehiro', 'Kenichiro Suehiro', '末廣健一郎'],
    canonicalTitle: 'Hitomi ni Utsuru Keshiki',
    aliases: ['Hitomi ni Utsuru Keshiki', '瞳ニ映ル景色'],
    evidence: ['https://girls-last-tour.com/products/music.html', 'https://www.youtube.com/watch?v=HMAfMwLVLdU', 'https://anisongdb.com/'],
  },
  {
    artist: 'Hina Kino, Rika Nagae, Konomi Kohara feat. Ikepy & KSKN',
    artistAliases: ['本田華子(CV:木野日菜), オリヴィア(CV:長江里加), 野村香純(CV:小原好美) feat. Ikepy & KSKN'],
    canonicalTitle: 'Inkya Impulse',
    aliases: ['Inkya Impulse', 'インキャインパルス'],
    evidence: ['https://asobiasobase.com/products/music.html'],
  },
  {
    artist: 'GRANRODEO',
    canonicalTitle: 'Hengenjizai no Magical Star',
    aliases: ['Hengenjizai no Magical Star', 'Hengen Jizaino Majikaru Star', '変幻自在のマジカルスター'],
    evidence: ['https://www.youtube.com/watch?v=c0aDpjEebpw'],
  },
  {
    artist: 'Madoka Yonezawa',
    artistAliases: ['Setsuna Ogiso (CV: Madoka Yonezawa)', '小木曽雪菜(CV:米澤円)'],
    canonicalTitle: 'SOUND OF DESTINY',
    aliases: ['SOUND OF DESTINY'],
    evidence: ['https://store.kingrecords.co.jp/shop/g/gKIGA-23/', 'https://blog.aquaplus.jp/archives/4390'],
  },
  {
    artist: 'Labyrinths',
    artistAliases: ['らびりんず', 'らびりんず 千矢(CV.原田彩楓)&紺(CV.本渡 楓)&小梅(CV.久保ユリカ)&ノノ(CV.佳村はるか)'],
    canonicalTitle: 'Yumeji Labyrinth',
    aliases: ['Yumeji Labyrinth', '夢路らびりんす'],
    evidence: ['https://www.tbs.co.jp/anime/urara/disc/cd01.html'],
  },
  {
    artist: 'Hikaru Toono',
    artistAliases: ['Anna Yanami (CV: Hikaru Tono)', 'Anna Yanami (CV: Hikaru Toono)', '八奈見杏菜(CV.遠野ひかる)'],
    canonicalTitle: 'LOVE2000',
    aliases: ['LOVE2000', 'LOVE 2000'],
    evidence: ['https://www.aniplex.co.jp/lineup/makeine/news/detail/?id=65790', 'https://www.youtube.com/watch?v=2czbGCYz6gk'],
  },
  {
    artist: 'TRUE',
    canonicalTitle: 'STEEL -Tekketsu no Kizuna-',
    aliases: ['STEEL', 'STEEL -Tekketsu no Kizuna-', 'STEEL -鉄血の絆-'],
    evidence: ['https://www.lantis.jp/title/g_tekketsu/disco_all.html'],
  },
  {
    artist: 'Rena Uehara',
    canonicalTitle: "After All ~Tsuzuru Omoi~ '13",
    aliases: ["After All ~Tsuzuru Omoi~ '13", "After All Tsuduru Omoi '13", "After All ~綴る想い~ '13"],
    evidence: ['https://store.kingrecords.co.jp/shop/g/gKIGA-23/', 'https://blog.aquaplus.jp/archives/4390'],
  },
  {
    artist: 'Shizuru Ohtaka',
    artistAliases: ['Sizzle Ohtaka', 'おおたか静流'],
    canonicalTitle: 'Natsu o Miteita',
    aliases: ['Natsu o Miteita', '夏を見ていた'],
    evidence: ['https://www.hotarubi.info/music/'],
  },
  {
    artist: 'TOGENASHI TOGEARI',
    canonicalTitle: 'Zattou, Bokura no Machi',
    aliases: ['Zattou, Bokura no Machi', 'Wrong World', '雑踏、僕らの街'],
    evidence: ['https://www.youtube.com/watch?v=YDLafQ-Rg-k', 'https://girls-band-cry.com/news/post-107.html'],
  },
  {
    artist: 'Huwie Ishizaki',
    canonicalTitle: 'Pino to Amélie',
    aliases: ['Pino to Amélie', 'Pino to Amelie', 'Pino to Ameri', 'ピノとアメリ'],
    evidence: ['https://www.sonymusic.co.jp/artist/ishizakihuwie/info/471355', 'https://anisongdb.com/'],
  },
  {
    artist: 'Ai Kayano',
    artistAliases: ['シルフィエット(CV:茅野愛衣)', 'シルフィエット(CV.茅野愛衣)'],
    canonicalTitle: 'Hanaemi',
    aliases: ['Hanaemi', '花咲み'],
    evidence: ['https://mushokutensei.jp/music/', 'https://nex-tone.link/HkSRMkeZu'],
  },
  {
    artist: 'MAYUKO & Luminous',
    // The soundtrack release credits its composer; equivalence applies only to this cue.
    artistAliases: ['Kenichiro Suehiro', '末廣健一郎'],
    canonicalTitle: 'Owari no Uta',
    aliases: ['Owari no Uta', '終ワリノ歌'],
    evidence: ['https://girls-last-tour.com/products/music.html', 'https://www.youtube.com/watch?v=67STFqbZxTM', 'https://anisongdb.com/'],
  },
  {
    artist: 'Maon Kurosaki',
    canonicalTitle: 'Gensou no Rondo',
    aliases: ['Gensou no Rondo', '幻想の輪舞'],
    evidence: ['https://nbcuni-music.com/maon/contents/hp0007/index00290000.html'],
  },
  {
    artist: 'Sora Amamiya, Rie Takahashi, Ai Kayano',
    canonicalTitle: 'Chiisana Boukensha',
    aliases: ['Chiisana Boukensha', 'ちいさな冒険者'],
    evidence: ['https://columbia.jp/prod-info/COCC-17103/'],
  },
  {
    artist: 'Mass Alert',
    canonicalTitle: 'Tada Yowai dake ja Nakute Bokura wa...',
    aliases: ['Tada Yowai dake ja Nakute Bokura wa...', 'Tada Yowai Dakejanakute Bokurawa', 'ただ弱いだけじゃなくて僕らは…'],
    recordingAliases: ['Tada Yowai Dakejanakute Bokurawa - NARUTO Syonenhen Version'],
    evidence: ['https://www.sonymusic.co.jp/artist/massalert/info/337534', 'https://www.tv-tokyo.co.jp/anime/naruto/news/news04/index.html'],
  },
  {
    artist: 'Hina Kino, Rika Nagae, Konomi Kohara',
    canonicalTitle: 'Three-Piece',
    aliases: ['スリピス', 'Suripisu', 'Three-Piece'],
    evidence: ['https://asobiasobase.com/products/music.html', 'https://anisongdb.com/'],
  },
  {
    artist: 'Kenshi Yonezu',
    artistAliases: ['米津玄師'],
    canonicalTitle: 'Chikyuugi',
    aliases: ['Chikyuugi', 'Chikyugi', 'Chikyugi - Spinning Globe', '地球儀', '地球儀 - Spinning Globe', 'Spinning Globe'],
    evidence: ['https://www.youtube.com/watch?v=abKcYyQ1V7Y', 'https://www.youtube.com/watch?v=M98h-ucIcBs', 'https://anisongdb.com/'],
  },
  {
    artist: 'Mika Kobayashi',
    artistAliases: ['Hiroyuki Sawano', 'Sawano Hiroyuki', '澤野弘之'],
    canonicalTitle: 'βίος <MK+nZk Version>',
    aliases: ['Bios <MK+nZk Version>', 'βios <MK+nZk Version>', 'βiοs <MK+nZk Version>'],
    evidence: ['https://www.sonymusic.co.jp/jlist/soundtrack/SVWC-70156', 'https://music.apple.com/us/song/1537796747'],
  },
  {
    artist: 'Tomoyo Kurosawa',
    artistAliases: ['Itsuki Inubouzaki', 'Inubouzaki Itsuki', '犬吠埼樹(CV:黒沢ともよ)', '犬吠埼樹'],
    canonicalTitle: 'Inori no Uta',
    aliases: ['祈りの歌'],
    evidence: ['https://yuyuyu.tv/season1/music/pccg70231.php', 'https://music.apple.com/us/album/inori-no-uta/1484911659?i=1484911733'],
  },
  {
    artist: 'Aira Yuuki',
    artistAliases: ['結城アイラ', 'Aira Yuki'],
    canonicalTitle: 'Donna Hoshizora yori mo, Donna Omoide yori mo',
    aliases: ['どんな星空よりも、どんな思い出よりも'],
    evidence: ['https://www.imotosae.com/products/cd/ed.php'],
  },
  {
    artist: 'Haruna Ooshima',
    artistAliases: ['大島はるな', 'Haruna Oshima'],
    canonicalTitle: 'Koi no Balloon',
    aliases: ['恋のバルーン'],
    evidence: ['https://www.youtube.com/watch?v=t3Xvy8tGyRc'],
  },
  {
    artist: 'Yuiko Ohara',
    canonicalTitle: 'Musubime',
    aliases: ['ムスビメ'],
    evidence: ['https://mushokutensei.jp/news/230526_2/'],
  },
  {
    artist: 'Yuuko Natsuyoshi',
    artistAliases: ['HoneyWorks, Cosmic Princess Kaguya! & Kaguya(cv.Yuko Natsuyoshi)', 'HoneyWorks & Kaguya (CV: Yuko Natsuyoshi)', 'HoneyWorks & かぐや (CV: 夏吉ゆうこ)', 'Yuko Natsuyoshi'],
    canonicalTitle: 'Watashi wa, Watashi no Koto ga Suki.',
    aliases: ['Watashiwa Watashino Kotoga Suki', '私は、わたしの事が好き。'],
    evidence: ['https://www.youtube.com/watch?v=J5tRnYiHifE', 'https://linkco.re/cyZr0VFS?lang=en'],
  },
  {
    artist: 'supercell feat. Hatsune Miku',
    artistAliases: ['ryo', 'ryo (supercell) feat. Hatsune Miku', 'ryo feat. Hatsune Miku'],
    canonicalTitle: 'Black★Rock Shooter',
    aliases: ['Black Rock Shooter', 'ブラック★ロックシューター'],
    recordingAliases: ['Black Rock Shooter (feat. Hatsune Miku) [2M Mix]', 'Black Rock Shooter [2M Mix]'],
    evidence: ['https://www.fujitv.co.jp/b_hp/noitamina-brs/index.html', 'https://blackrockshooter.jp/history/', 'https://anisongdb.com/'],
  },
  {
    artist: 'Noriko Watanabe',
    canonicalTitle: 'Shounen Kenya',
    aliases: ['少年ケニヤ'],
    evidence: ['https://www.kadokawa.co.jp/product/video1107/'],
  },
  {
    artist: CARNIVAL_PHANTASM_OPENING_CAST,
    canonicalTitle: 'Super☆Affection',
    aliases: ['すーぱー☆あふぇくしょん'],
    evidence: ['https://www.typemoon.com/products/cp/outline.html'],
  },
  {
    artist: 'DIALOGUE+',
    canonicalTitle: 'Deneb to Spica',
    aliases: ['Deneb and Spica', 'デネブとスピカ'],
    evidence: ['https://dialogue-music.jp/discography/14_deneb%26spica/', 'https://www.ponycanyon.co.jp/music/PCCG000002164'],
  },
  {
    artist: 'Yoko Takahashi',
    canonicalTitle: 'Zankoku na Tenshi no Thesis',
    aliases: ["The Cruel Angel's Thesis", "A Cruel Angel's Thesis", '残酷な天使のテーゼ', 'Zankoku na Tenshi no Teze'],
    evidence: ['https://www.youtube.com/watch?v=o6wtDPVkKqI', 'https://king-cr.jp/artist/takahashi/discography/'],
  },
  {
    artist: 'Aya Hirano',
    canonicalTitle: 'CURE ~Boku ga Koko ni Iru yo~',
    aliases: ['Cure ~僕がここにいるよ~'],
    evidence: ['https://columbia.jp/prod-info/COCX-35798/'],
  },
  {
    artist: 'Kalafina',
    canonicalTitle: 'Kimi no Gin no Niwa',
    aliases: ['君の銀の庭'],
    evidence: ['https://www.madoka-magica.com/rebellion/news/?id=27218', 'https://anisongdb.com/'],
  },
  {
    artist: 'Hiroyuki Sawano',
    canonicalTitle: 'REVIVƎЯ',
    aliases: ['REVIVER'],
    evidence: ['https://www.aniplex.co.jp/news/detail/?id=67275', 'https://music.apple.com/us/song/1807477184'],
  },
  {
    artist: 'sumika',
    canonicalTitle: 'Shunkashuutou',
    aliases: ['Shunkashuto', 'Shunkashūtō', '春夏秋冬'],
    evidence: ['https://kimisui-anime.com/news/?article_id=47814', 'https://anisongdb.com/'],
  },
  {
    artist: 'MICHI',
    canonicalTitle: 'Soranetarium',
    aliases: ['Solanetarium', 'ソラネタリウム'],
    evidence: ['https://www.ytv.co.jp/akanesasus/', 'https://music.apple.com/us/album/1439298955'],
  },
  {
    artist: 'Yuuka Aisaka',
    canonicalTitle: 'L・O・V・E・Ly Loco♡',
    aliases: ['L・O・V・E・LY LOCO', 'L.O.V.E.LY LOCO', 'L・O・V・E・リーロコ♡', 'L・O・V・E・リー ロコ♡'],
    evidence: ['https://www.youtube.com/watch?v=uxPavPqtuGc', 'https://music.apple.com/us/song/1733426741'],
  },
  {
    artist: 'IOSYS jk Girls',
    canonicalTitle: 'Stalemate!',
    aliases: ['すているめいと!'],
    evidence: ['https://d-fragments.net/products/music.html'],
  },
  {
    artist: 'Shion Miyawaki',
    canonicalTitle: 'Mata Kimi ni Aeru Hi',
    aliases: ['Mata Kimini Aeruhi', 'また君に会える日'],
    evidence: ['https://www.ansatsu-anime.com/2014-2016/news/detail.php?id=1033336'],
  },
  {
    artist: "Minori Suzuki",
    canonicalTitle: "Dame wa Dame",
    aliases: ["ダメハダメ"],
    recordingAliases: ["Dame wa Dame (Jo Mino Ver.)","ダメハダメ (Album Ver.)","ダメハダメ (Jo Mino Ver.)"],
    evidence: ["https://www.jvcmusic.co.jp/flyingdog/-/Discography/A025540/VTZL-175.html","https://music.apple.com/us/song/1526082403"],
  },
  {
    artist: "pua:re",
    canonicalTitle: "Koi no Himitsu",
    aliases: ["恋のヒミツ"],
    evidence: ["https://columbia.jp/prod-info/COZC-1385-6/"],
  },
  {
    artist: "Minori Chihara",
    canonicalTitle: "Mermaid Lovestory",
    aliases: ["Mermaid Love Story","マーメイド ラブストーリー"],
    evidence: ["https://columbia.jp/prod-info/COCX-38577/","https://music.apple.com/us/song/1447344360"],
  },
  {
    artist: "nano.RIPE",
    canonicalTitle: "Saibou Kioku",
    aliases: ["Saibo Kioku","Saibō Kioku","細胞キオク"],
    evidence: ["https://www.lantis.jp/special/nanoripe/saiboukioku/","https://catalog.bandainamcomusiclive.co.jp/release/65938/"],
  },
  {
    artist: "yozuca*",
    canonicalTitle: "Platinum 17",
    aliases: ["プラチナ17","Platina 17"],
    evidence: ["https://boku-h.com/release/cd.html","https://www.lantis.jp/en/artist/7c641b08858003259aababf5333f0b72/"],
  },
  {
    artist: "CooRie & yozuca*",
    canonicalTitle: "Platinum 17",
    aliases: ["プラチナ17","Platina 17"],
    evidence: ["https://boku-h.com/release/cd.html","https://music.apple.com/jp/album/549755274"],
  },
  {
    artist: "Eri Sasaki",
    canonicalTitle: "Fuyu Biyori",
    aliases: ["Fuyubiyori","ふゆびより"],
    evidence: ["https://yurucamp.jp/first/music/","https://music-link.ani-tone.com/fuyubiyori/"],
  },
  ...ALYA_SONG_CREDITS.filter(credit => credit.title !== credit.nativeTitle).map(credit => ({
    artist: credit.artist,
    canonicalTitle: credit.title,
    aliases: [credit.nativeTitle],
    evidence: [credit.sourceUrl],
  })),
  {
    artist: 'Megumi Han',
    canonicalTitle: 'four',
    aliases: ['four covered by KAHONO', 'four coverd by KAHONO'],
    evidence: ['https://bclover.jp/season1/news/detail.php?id=1065606', 'https://avexnet.jp/contents/FAKYJ-XXXX-XXXX/discography/1019293'],
  },
  {
    artist: 'Eve',
    canonicalTitle: 'Kaze no Anthem',
    aliases: ["Wind's Anthem", '風のアンセム'],
    evidence: ['https://eveofficial.com/discography/kazenoanthem.html', 'https://www.youtube.com/watch?v=ySpIrrCmiCU'],
  },
  {
    artist: 'Aoi Yuki',
    canonicalTitle: 'Gekisou Gungnir',
    aliases: ['撃槍・ガングニール', 'Gekisō Gungnir'],
    evidence: ['https://www.symphogear.com/sound.html', 'https://anisongdb.com/'],
  },
  {
    artist: 'ICHIKO',
    canonicalTitle: 'Chiisana Bokura no Ookina Heart',
    aliases: ['小さな僕らの大きなハート'],
    evidence: ['https://www.sunrise-inc.co.jp/work/news.php?id=1804', 'https://anisongdb.com/'],
  },
  {
    artist: 'HOW MERRY MARRY',
    canonicalTitle: 'Boku ni Dekiru Koto',
    aliases: ['僕にできること', 'Boku ni Dekirukoto'],
    evidence: ['https://www.sonymusic.co.jp/artist/howmerrymarry/discography/ESCL-3759', 'https://anisongdb.com/'],
  },
  {
    artist: 'Mayumi Gojo',
    canonicalTitle: 'Yume ni Yell! Pâtissière♪',
    aliases: ['夢にエール!パティシエール♪', 'Yume ni Yell! Patissiere'],
    evidence: ['https://columbia.jp/prod-info/COCC-16319/', 'https://anisongdb.com/'],
  },
  {
    artist: 'Megumi Nakajima',
    canonicalTitle: 'Ai Oboete Imasu ka ~bless the little queen',
    aliases: ['Ai Oboete Imasu ka - bless the little queen', '愛・おぼえていますか～bless the little queen'],
    evidence: ['https://www.jvcmusic.co.jp/flyingdog/-/Discography/A008451/VTCL-60061.html', 'https://anisongdb.com/'],
  },
  {
    artist: 'Team "Hanayamata"',
    canonicalTitle: 'Hana wa Odore ya Irohaniho',
    aliases: ['花ハ踊レヤいろはにほ'],
    evidence: ['https://hanayamata.com/discography/detail.php?id=1008379', 'https://anisongdb.com/'],
  },
  {
    artist: 'Hironobu Kageyama & BROADWAY',
    canonicalTitle: 'Yume Tabibito',
    aliases: ['夢旅人', '夢旅人 -BLUE DREAM-', 'BLUE DREAM～夢旅人～', 'BLUE DREAM~夢旅人~(聖闘士星矢/TVサイズ)'],
    evidence: ['https://columbia.jp/prod-info/COCX-35079-91/', 'https://anisongdb.com/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Hebi',
    aliases: ['へび', 'Snake'],
    evidence: ['https://yorushika.com/news/detail/11658?lang=en', 'https://www.universal-music.co.jp/yorushika/products/up1aa-00814/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Haru',
    aliases: ['晴る', 'Sunny'],
    evidence: ['https://frieren-anime.jp/music/1st_2/', 'https://www.universal-music.co.jp/yorushika/products/up1aa-00814/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Aporia',
    aliases: ['アポリア'],
    evidence: ['https://yorushika.com/news/detail/11625'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Kaseijin',
    aliases: ['火星人', 'Martian'],
    evidence: ['https://yorushika.com/discography/detail/70/', 'https://yorushika.com/news/detail/11670?lang=en'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Gekkouyoku',
    aliases: ['月光浴', 'Moonbath', 'Gekkōyoku'],
    evidence: ['https://ooyukiumi.net/music/', 'https://www.universal-music.co.jp/yorushika/products/up1aa-00814/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Shayou',
    aliases: ['斜陽', 'Setting Sun', 'Shayō'],
    evidence: ['https://yorushika.com/news/detail/11520?lang=en', 'https://yorushika.com/lyrics/detail/64/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Telepath',
    aliases: ['テレパス'],
    evidence: ['https://yorushika.com/news/detail/11440'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Hana ni Bourei',
    aliases: ['花に亡霊', 'Ghost in a Flower'],
    evidence: ['https://www.youtube.com/watch?v=9lVPAWLWtWc'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Usotsuki',
    aliases: ['嘘月'],
    evidence: ['https://www.universal-music.co.jp/yorushika/news/2020-06-12/', 'https://yorushika.com/news/detail/11141?lang=en'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Yako',
    aliases: ['夜行', 'Night Journey', 'Yakou', 'Yakō'],
    evidence: ['https://yorushika.com/news/detail/11012', 'https://anisongdb.com/'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Abuku',
    aliases: ['あぶく', 'Bubble'],
    evidence: ['https://www.youtube.com/watch?v=OHAjc-ayhus'],
  },
  {
    artist: 'Yorushika',
    canonicalTitle: 'Akane',
    aliases: ['茜'],
    evidence: ['https://www.youtube.com/watch?v=VD_ztcqWBAY', 'https://anisongdb.com/'],
  },
  {
    artist: 'Saori Kodama',
    canonicalTitle: 'Mikansei Stride',
    aliases: ['未完成ストライド', 'Mikansei Stride'],
    evidence: ['https://kotenbu.com/goods/cd_op2.html', 'https://www.lantis.jp/release-item/LACM-4955.html/1000', 'https://anisongdb.com/'],
  },
  {
    artist: 'Megumi Nakajima',
    canonicalTitle: 'Kami-kazari no Tenshi',
    aliases: ['Kami-kazari no Tenshi', 'Kamikazari no Tenshi', '髪飾りの天使'],
    evidence: [
      'https://booklove-anime.jp/season3/cd/d1.html',
      'https://www.jvcmusic.co.jp/flyingdog/-/Discography/A021733/VTCL-35309.html',
      'https://anisongdb.com/',
    ],
  },
  {
    artist: 'Pet na Kanojo-tachi',
    canonicalTitle: 'Kimi ga Yume o Tsuretekita',
    aliases: ['君が夢を連れてきた', 'Kimi ga Yume o Tsuretekita', 'Kimi ga Yume wo Tsuretekita'],
    evidence: [
      'https://sakurasou.tv/news/archives/120903_oped.html',
      'https://akihata.jp/works/music/7795/',
      'https://anisongdb.com/',
    ],
  },
  {
    artist: 'Miyuki Sawashiro',
    canonicalTitle: 'Onegai☆Snyaiper',
    aliases: ['Onegai☆Snyaiper', 'おねがい☆すにゃいぱー'],
    evidence: [
      'https://open.spotify.com/track/0bRaIPC9P0Uz4oVD3QW5kr',
      'https://ngnl.jp/staff-cast/',
      'https://anisongdb.com/',
    ],
  },
  {
    artist: 'Reina Ueda',
    canonicalTitle: 'Literature',
    aliases: ['Literature', 'リテラチュア', 'Riterachua'],
    evidence: [
      'https://www.lantis.jp/news.php?id=1595505597',
      'https://majotabi.jp/news.html',
      'https://anisongdb.com/',
    ],
  },
  {
    artist: 'Tatsuro Yamashita',
    canonicalTitle: 'Uta no Kisha',
    aliases: ['Music Train', 'Uta no Kisha', 'うたのきしゃ'],
    evidence: [
      'https://www.tatsuro.co.jp/discography/single.php',
      'https://fetch.fm/media/uploads/production-notes/2018/09/06/12/27/MIRAI_Production_Notes.pdf',
    ],
  },
  {
    artist: '7!!',
    canonicalTitle: 'Orange',
    aliases: ['Orange', 'オレンジ'],
    evidence: ['https://www.kimiuso.jp/music/04.html'],
  },
  {
    artist: 'Aimer',
    canonicalTitle: 'Akane Sasu',
    aliases: ['Akane Sasu', 'Akanesasu', '茜さす'],
    evidence: [
      'https://www.natsume-anime.jp/news/1446?category=info_music',
      'https://api.animethemes.moe/song?filter[title-like]=Akane%20Sasu&include=artists,animethemes.anime',
    ],
  },
  {
    artist: 'Novelbright',
    canonicalTitle: 'Yuki no Oto',
    aliases: ['雪の音', 'Yukinone', 'Yuki no Oto', 'Yuki no Ne', 'Sound of Snow'],
    evidence: [
      'https://novelbright.jp/news/detail/1665?lang=en',
      'https://api.animethemes.moe/anime/yubisaki_to_renren?include=animethemes.song.artists',
      'https://www.youtube.com/watch?v=aLgPe4Scnvs',
      'https://novelbright.lnk.to/SoundofSnow',
    ],
  },
];

/** Prefer artist-scoped aliases; reviewed nicknames may also discover unverified covers. */
export function canonicalTitleFor(title: string, artist: string): string {
  const queryTitle = withoutFeaturedCredit(withoutAnimeCredit(title));
  return findAlias(queryTitle, artist, 'aliases') ?? VERIFIED_TITLE_ALIASES.find(entry =>
    entry.titleOnlyAliases?.some(alias => normalizeSongText(alias) === normalizeSongText(queryTitle)),
  )?.canonicalTitle ?? queryTitle;
}

/** Normalize an explicit version label or a documented release-specific title. */
export function canonicalBaseTitleFor(title: string, artist: string): string | undefined {
  const versionBase = baseRecordingTitle(title);
  if (versionBase) return canonicalTitleFor(versionBase, artist);
  return findAlias(withoutFeaturedCredit(withoutAnimeCredit(title)), artist, 'recordingAliases');
}

function findAlias(queryTitle: string, artist: string, field: 'aliases' | 'recordingAliases'): string | undefined {
  const normalizedTitle = normalizeSongText(queryTitle);
  const normalizedArtist = canonicalArtist(artist);
  return VERIFIED_TITLE_ALIASES.find(entry =>
    entry[field]?.some(value => normalizeSongText(value) === normalizedTitle) && matchesArtist(entry, normalizedArtist),
  )?.canonicalTitle;
}

function matchesArtist(entry: VerifiedTitleAlias, normalizedArtist: string): boolean {
  return canonicalArtist(entry.artist) === normalizedArtist ||
    entry.artistAliases?.some(alias => canonicalArtist(alias) === normalizedArtist) === true;
}

/** Resolve release-specific credits only for the verified canonical song. */
export function canonicalArtistForTitle(canonicalTitle: string, artist: string): string {
  const normalizedTitle = normalizeSongText(canonicalTitle);
  const normalizedArtist = canonicalArtist(artist);
  const entry = VERIFIED_TITLE_ALIASES.find(record =>
    record.artistAliases && normalizeSongText(record.canonicalTitle) === normalizedTitle && matchesArtist(record, normalizedArtist),
  );
  return entry ? canonicalArtist(entry.artist) : normalizedArtist;
}
