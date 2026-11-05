const ARABIC_DIACRITICS_PATTERN = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_TATWEEL_PATTERN = /\u0640/g;
const ARABIC_INDIC_DIGITS_PATTERN = /[\u0660-\u0669]/g;
const ARABIC_TO_LATIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ARABIC_LETTERS_PATTERN = /[\u0621-\u064A]/g;
const COMBINING_MARKS_PATTERN = /[\u0300-\u036F]/g;
const NON_SLUG_PATTERN = /[^a-z0-9]+/g;

export function normalizeArabicText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS_PATTERN, '')
    .replace(ARABIC_TATWEEL_PATTERN, '')
    .replace(
      ARABIC_INDIC_DIGITS_PATTERN,
      (digit) => ARABIC_TO_LATIN_DIGITS[digit.charCodeAt(0) - 0x0660] ?? digit,
    )
    .trim();
}

export function normalizeSearchText(input: string): string {
  return normalizeArabicText(input)
    .replace(COMBINING_MARKS_PATTERN, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function transliterateArabicForSlug(input: string): string {
  return normalizeArabicText(input)
    .replace(ARABIC_LETTERS_PATTERN, '')
    .toLowerCase()
    .replace(NON_SLUG_PATTERN, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugify(input: string): string {
  const transliterated = transliterateArabicForSlug(input);
  if (transliterated.length > 0) {
    return transliterated;
  }
  let hash = 0;
  for (const character of normalizeArabicText(input)) {
    hash = (hash * 31 + character.codePointAt(0)!) % 1_000_000_007;
  }
  return `item-${hash.toString(36)}`;
}

export function truncateText(input: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}
