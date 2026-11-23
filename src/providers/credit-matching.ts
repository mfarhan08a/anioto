import { toRomaji } from 'wanakana';
import { canonicalArtist } from './artist-aliases';
import { normalizeSongText } from './song-titles';

/** A phonetic spelling key, not a translator: kanji and English loanwords stay distinct. */
export function scriptKey(value: string): string {
  return normalizeSongText(toRomaji(value.normalize('NFKC'))).replaceAll(' ', '');
}

/** Split release credits only at explicit separators, taking the actor inside CV labels. */
export function performerNames(value: string): string[] {
  const normalized = value.normalize('NFKC');
  return [...new Set(normalized.split(/\s*[,、&]\s*|\s+and\s+/i).map(credit => {
    const actor = credit.match(/\(\s*CV\s*[.:：]\s*([^()]+)\)/i);
    return (actor?.[1] ?? credit).trim();
  }).filter(Boolean))];
}

/** Complete, order-independent credits only; a solo member never becomes the entire group. */
export function samePerformers(input: string, source: readonly (readonly string[])[]): boolean {
  const names = performerNames(input);
  if (names.length !== source.length || !source.length) return false;
  const key = (name: string) => scriptKey(canonicalArtist(name));
  const unused = [...source];
  for (const name of names) {
    const index = unused.findIndex(aliases => aliases.some(alias => key(alias) === key(name)));
    if (index < 0) return false;
    unused.splice(index, 1);
  }
  return true;
}

/** Bounded discovery strings; every response still needs a full local title check. */
export function titleDiscoveryQueries(title: string): string[] {
  const romanized = toRomaji(title.normalize('NFKC'));
  const clean = normalizeSongText(romanized);
  // A complete romanized title may have different word boundaries in the catalog.
  const words = clean.split(' ').filter(word => /^[a-z0-9]{4,}$/i.test(word));
  const longest = [...words].sort((a, b) => b.length - a.length)[0];
  const prefix = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(title) && /^[a-z]{8,}$/.test(clean)
    ? clean.slice(0, 6) : longest;
  return [...new Set([clean, prefix].filter((value): value is string => !!value && value.length >= 4))]
    .filter(value => value !== title).slice(0, 2);
}
