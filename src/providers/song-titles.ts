/** Normalize credit text without erasing meaningful words from song titles. */
export function normalizeSongText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/&/g, ' and ').replace(/\b(feat(?:uring)?|ft)\.?\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

const TV_SIZE_MARKER = String.raw`tv[\s-]?(?:size|\u30b5\u30a4\u30ba)(?:\s+(?:version|ver\.?))?`;
const JAPANESE_VERSION_MARKER = String.raw`(?:カラオケ(?:音源|版)?|インスト(?:ゥルメンタル)?(?:版)?|オフ[・\s-]?ボーカル(?:版)?)`;
const VERSION_MARKER = String.raw`(?:(?:from\s+)?the\s+first\s+take|live(?:\s+(?:version|recording)|\s+at\s+[^)\]]{1,60})?|acoustic(?:\s+guitar)?(?:\s+(?:version|ver\.?|cover))?|cover(?:\s+version)?|piano(?:\s+(?:version|ver\.?|cover))?|remaster(?:ed)?(?:\s+version)?(?:\s+\d{4})?|instrumental(?:\s+(?:version|ver\.?))?|off[\s-]?vocal(?:\s+(?:version|ver\.?))?|karaoke(?:\s+(?:version|ver\.?))?|${JAPANESE_VERSION_MARKER}|${TV_SIZE_MARKER}|tv[\s-]?(?:edit|version|ver\.?)|underwater(?:\s+(?:version|ver\.?))?|slowed(?:\s*(?:[+/&]\s*|\s+)(?:and\s+)?reverb)?|sped[\s-]?up|speed[\s-]?up|nightcore(?:\s+(?:version|ver\.?))?)\.?`;
const EXPLICIT_VERSION_MARKER = String.raw`(?:${VERSION_MARKER}|anime[\s-]?size|tv[\s-]+(?:anime|animation)[\s-]+(?:version|ver\.?))`;
const VERSION_SUFFIX = new RegExp(String.raw`(?:\s*\(\s*${EXPLICIT_VERSION_MARKER}\s*\)|\s*\[\s*${EXPLICIT_VERSION_MARKER}\s*\]|\s+[-–—]\s*${EXPLICIT_VERSION_MARKER})\s*$`, 'i');

// Only explicit TV-size / TV-edit suffixes may be unbracketed; ordinary title words stay intact.
const BARE_TV_SUFFIX = new RegExp(String.raw`\s+(?:${TV_SIZE_MARKER}|tv[\s-]?edit)\.?\s*$`, 'i');

const FEATURE_CREDIT = String.raw`(?:feat(?:uring)?|ft)\.?\s+[^()[\]]{1,80}`;
const FEATURE_SUFFIX = new RegExp(String.raw`(?:\s+[-\u2013\u2014])?(?:\s*\(\s*${FEATURE_CREDIT}\s*\)|\s*\[\s*${FEATURE_CREDIT}\s*\]|\s+${FEATURE_CREDIT})\s*$`, 'i');

/** Strip explicit Japanese anime music metadata, preserving the quoted song title. */
export function withoutAnimeCredit(value: string): string {
  const title = value.normalize('NFKC').trim();
  const prefixed = title.match(/^(?:TV\s*)?アニメ\s*「[^」]+」\s*(?:主題歌|(?:オープニング|エンディング)[・\s-]?テーマ)\s*「([^」]+)」$/i);
  if (prefixed?.[1]?.trim()) return prefixed[1].trim();
  const credited = title.match(/^(.+?)\s*[~〜～]\s*「[^」]+」\s*(?:オープニング|エンディング)[・\s-]?テーマ$/i);
  if (credited?.[1]?.trim()) return credited[1].trim();
  const bare = title.replace(/\s*【\s*(?:TV\s*)?アニメ\s*「[^」]+」\s*(?:主題歌|オープニングテーマ|エンディングテーマ)\s*】$/i, '').trim();
  return bare || title;
}

/** A trailing guest credit is metadata, not a different recording or artist identity. */
export function withoutFeaturedCredit(value: string): string {
  let title = value.normalize('NFKC').trim();
  for (let index = 0; index < 2; index++) {
    const next = title.replace(FEATURE_SUFFIX, '').trim();
    if (!next || next === title) break;
    title = next;
  }
  return title;
}

/** Strip at most two explicit recording suffixes; never fuzzy-match fragments. */
export function baseRecordingTitle(value: string): string | undefined {
  let base = withoutFeaturedCredit(withoutAnimeCredit(value));
  let stripped = false;
  for (let index = 0; index < 2; index += 1) {
    base = withoutFeaturedCredit(base);
    const next = base.replace(VERSION_SUFFIX, '').replace(BARE_TV_SUFFIX, '').trim();
    if (next === base) break;
    base = next;
    stripped = true;
  }
  base = withoutFeaturedCredit(base);
  return stripped && normalizeSongText(base) ? base : undefined;
}
