import { describe, expect, it } from 'vitest';

import {
  formatPhoneForDisplay,
  isValidSyrianLandline,
  isValidSyrianMobile,
  maskPhoneForLogging,
  parseSyrianPhone,
} from '../src/phone.js';

describe('syrian phone handling', () => {
  it('accepts local, national and international mobile formats', () => {
    for (const value of [
      '0941234567',
      '941234567',
      '+963941234567',
      '963941234567',
      '0941 234 567',
    ]) {
      expect(isValidSyrianMobile(value)).toBe(true);
    }
  });

  it('follows the current Syrian mobile operator allocations', () => {
    for (const prefix of ['090', '093', '094', '095', '096', '098', '099']) {
      expect(isValidSyrianMobile(`${prefix}1234567`)).toBe(true);
    }
    for (const prefix of ['091', '092', '097']) {
      expect(isValidSyrianMobile(`${prefix}1234567`)).toBe(false);
    }
  });

  it('rejects malformed and out of range numbers', () => {
    for (const value of ['094123456', '0812345678', 'not-a-number', '', '094123456789012']) {
      expect(isValidSyrianMobile(value)).toBe(false);
    }
  });

  it('recognises damascus landlines', () => {
    expect(isValidSyrianLandline('0112345678')).toBe(true);
    expect(isValidSyrianLandline('+963112345678')).toBe(true);
    expect(isValidSyrianLandline('+963 11 234 5678')).toBe(true);
    expect(isValidSyrianLandline('0941234567')).toBe(false);
  });

  it('normalises a mobile number into E.164', () => {
    expect(parseSyrianPhone('0941234567')?.e164).toBe('+963941234567');
    expect(parseSyrianPhone('+963 941 234 567')?.nationalNumber).toBe('0941234567');
    expect(parseSyrianPhone('0941234567')?.kind).toBe('mobile');
  });

  it('returns null for values that cannot be parsed', () => {
    expect(parseSyrianPhone('0111234567')).toBeNull();
    expect(parseSyrianPhone('')).toBeNull();
  });

  it('formats for display in both locales', () => {
    expect(formatPhoneForDisplay('0941234567', 'en')).toBe('+963 941 234 567');
    expect(formatPhoneForDisplay('0941234567', 'ar')).toContain('+963');
  });

  it('never leaks a full phone number into logs', () => {
    const masked = maskPhoneForLogging('0941234567');
    expect(masked).toBe('+963***567');
    expect(masked).not.toContain('941234567');
    expect(maskPhoneForLogging('invalid')).toBe('***');
  });
});
