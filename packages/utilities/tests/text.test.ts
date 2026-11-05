import { describe, expect, it } from 'vitest';

import {
  normalizeArabicText,
  normalizeSearchText,
  normalizeWhitespace,
  slugify,
  truncateText,
} from '../src/text.js';

describe('arabic text normalisation', () => {
  it('strips diacritics and tatweel', () => {
    expect(normalizeArabicText('مُحَمَّد')).toBe('محمد');
    expect(normalizeArabicText('كــتاب')).toBe('كتاب');
  });

  it('converts Arabic-Indic digits into latin digits', () => {
    expect(normalizeArabicText('رقم ٩١٢٣٤٥٦٧٨')).toBe('رقم 912345678');
  });

  it('produces a stable comparable search key', () => {
    expect(normalizeSearchText("  O'Malley   Restaurant  ")).toBe("o'malley restaurant");
    expect(normalizeSearchText('مَطْعَمُ الشَّامِيّ')).toBe(normalizeSearchText('مطعم الشامي'));
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeWhitespace('a   b\n\tc')).toBe('a b c');
  });
});

describe('slug generation', () => {
  it('slugs latin input', () => {
    expect(slugify('Damazon Zone 3')).toBe('damazon-zone-3');
  });

  it('falls back to a stable hash when an Arabic name has no latin form', () => {
    const first = slugify('المنزل');
    const second = slugify('المنزل');
    expect(first).toBe(second);
    expect(first.startsWith('item-')).toBe(true);
    expect(slugify('المنزل')).not.toBe(slugify('العمل'));
  });
});

describe('truncation', () => {
  it('keeps short text untouched and adds an ellipsis when cutting', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('a very long product name', 10)).toBe('a very lo…');
    expect(truncateText('anything', 0)).toBe('');
  });
});
