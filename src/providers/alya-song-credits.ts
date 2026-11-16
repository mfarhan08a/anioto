const openingSource = 'https://roshidere.com/news/index00820000.html';
const endingSource = 'https://roshidere.com/music/ed.html';

export const ALYA_SEASON_ONE = {
  title: 'Alya Sometimes Hides Her Feelings in Russian',
  romajiTitle: 'Tokidoki Bosotto Russia-go de Dereru Tonari no Alya-san',
};

export const ALYA_SOLO = ['Sumire Uesaka', 'Uesaka Sumire', '上坂すみれ', 'アーリャ(CV:上坂すみれ)', 'Alya (CV: Sumire Uesaka)'] as const;
export const ALYA_KAF_DUET = [
  'Sumire Uesaka×KAF',
  `${ALYA_SOLO[0]} & KAF`,
  `${ALYA_SOLO[3]} & KAF`,
  `${ALYA_SOLO[3]} × KAF`,
  `${ALYA_SOLO[3]} × 花譜`,
  `${ALYA_SOLO[4]} × KAF`,
] as const;

/** Artist-specific title translations and official first-season credits. */
export const ALYA_SONG_CREDITS: readonly {
  id: number;
  title: string;
  nativeTitle: string;
  type: string;
  sourceUrl: string;
  artist: string;
}[] = [
  { id: -1025, title: '1-ban Kagayaku Hoshi', nativeTitle: '1番輝く星', type: 'Opening 1', sourceUrl: openingSource, artist: ALYA_SOLO[0] },
  { id: -1026, title: 'Gakuen Tengoku', nativeTitle: '学園天国', type: 'Ending 1', sourceUrl: openingSource, artist: ALYA_SOLO[0] },
  { id: -1027, title: 'Kawaikute Gomen', nativeTitle: '可愛くてごめん', type: 'Ending 2', sourceUrl: endingSource, artist: ALYA_SOLO[0] },
  { id: -1028, title: 'Omoide ga Ippai', nativeTitle: '想い出がいっぱい', type: 'Ending 3', sourceUrl: endingSource, artist: ALYA_SOLO[0] },
  { id: -1029, title: 'Hare Hare Yukai', nativeTitle: 'ハレ晴レユカイ', type: 'Ending 4', sourceUrl: endingSource, artist: ALYA_SOLO[0] },
  { id: -1023, title: 'Chiisana Koi no Uta', nativeTitle: '小さな恋のうた', type: 'Ending 5', sourceUrl: 'https://www.youtube.com/watch?v=0ronVoomulM', artist: ALYA_SOLO[0] },
  { id: -1030, title: 'Himitsu no Kotoba', nativeTitle: '秘密の言葉', type: 'Ending 6', sourceUrl: endingSource, artist: ALYA_KAF_DUET[0] },
  { id: -1031, title: 'Love Story wa Totsuzen ni', nativeTitle: 'ラブ・ストーリーは突然に', type: 'Ending 7', sourceUrl: endingSource, artist: ALYA_SOLO[0] },
  { id: -1032, title: 'CHE.R.RY', nativeTitle: 'CHE.R.RY', type: 'Ending 8', sourceUrl: endingSource, artist: ALYA_SOLO[0] },
  { id: -1022, title: 'World is Mine', nativeTitle: 'ワールドイズマイン', type: 'Ending 9', sourceUrl: 'https://www.youtube.com/watch?v=HrHPgipTDAU', artist: ALYA_SOLO[0] },
  { id: -1024, title: 'Koi no Uta', nativeTitle: 'こいのうた', type: 'Ending 10', sourceUrl: 'https://www.youtube.com/watch?v=tqdEDUyrJ1k', artist: ALYA_SOLO[0] },
  { id: -1033, title: 'Kimagure Romantic', nativeTitle: '気まぐれロマンティック', type: 'Ending 11', sourceUrl: 'https://www.youtube.com/watch?v=-5HZqR6OfYI', artist: ALYA_SOLO[0] },
  { id: -1034, title: 'Hana mo Yoi', nativeTitle: 'ハナモヨイ', type: 'Ending 12', sourceUrl: 'https://www.youtube.com/watch?v=spO_gsp-uUs', artist: ALYA_SOLO[0] },
];
