export const SYRIAN_COUNTRY_CODE = '+963';

// ITU's 2026 Syria plan lists 090, 093-096, 098, and 099 as active mobile
// operator codes; 091, 092, and 097 are not in use.
const SYRIAN_MOBILE_PATTERN = /^(?:\+?963|0)?9[0345689]\d{7}$/;

const SYRIAN_LANDLINE_PATTERN = /^(?:\+?963|0)?1\d{8,9}$/;

const GENERIC_INTERNATIONAL_PATTERN = /^\+[1-9]\d{7,14}$/;

export type PhoneKind = 'mobile' | 'landline' | 'unknown';

export interface ParsedPhone {
  readonly e164: string;
  readonly nationalNumber: string;
  readonly countryCode: string;
  readonly kind: PhoneKind;
}

export function normalizePhoneInput(input: string): string {
  return input.replace(/[\s\-().]/g, '');
}

export function isValidSyrianMobile(input: string): boolean {
  return SYRIAN_MOBILE_PATTERN.test(normalizePhoneInput(input));
}

export function isValidInternationalPhone(input: string): boolean {
  return GENERIC_INTERNATIONAL_PATTERN.test(normalizePhoneInput(input));
}

export function isValidSyrianLandline(input: string): boolean {
  return SYRIAN_LANDLINE_PATTERN.test(normalizePhoneInput(input));
}

export function parseSyrianPhone(input: string): ParsedPhone | null {
  const normalized = normalizePhoneInput(input);
  if (!isValidSyrianMobile(normalized)) {
    return null;
  }
  const local = normalized.replace(/^(?:\+?963|0)/, '');
  const nationalNumber = `0${local}`;
  return {
    e164: `${SYRIAN_COUNTRY_CODE}${local}`,
    nationalNumber,
    countryCode: SYRIAN_COUNTRY_CODE,
    kind: 'mobile',
  };
}

export function formatPhoneForDisplay(input: string, locale: 'ar' | 'en' = 'ar'): string {
  const parsed = parseSyrianPhone(input);
  if (!parsed) {
    return input;
  }
  const local = parsed.e164.replace(SYRIAN_COUNTRY_CODE, '');
  return locale === 'ar'
    ? `+963 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
    : `+963 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function maskPhoneForLogging(input: string): string {
  const parsed = parseSyrianPhone(input);
  if (!parsed) {
    return '***';
  }
  return `${SYRIAN_COUNTRY_CODE}***${parsed.e164.slice(-3)}`;
}
