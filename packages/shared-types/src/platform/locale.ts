export const SUPPORTED_LOCALES = {
  AR: 'ar',
  EN: 'en',
} as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[keyof typeof SUPPORTED_LOCALES];

export const ALL_SUPPORTED_LOCALES = Object.values(SUPPORTED_LOCALES) as readonly SupportedLocale[];

export const DEFAULT_LOCALE = SUPPORTED_LOCALES.AR;

export const FALLBACK_LOCALE = SUPPORTED_LOCALES.EN;

export const RTL_LOCALES = [SUPPORTED_LOCALES.AR] as const satisfies readonly SupportedLocale[];

export const LOCALE_DIRECTION = {
  [SUPPORTED_LOCALES.AR]: 'rtl',
  [SUPPORTED_LOCALES.EN]: 'ltr',
} as const satisfies Record<SupportedLocale, 'rtl' | 'ltr'>;

export const LOCALE_HTML_LANG = {
  [SUPPORTED_LOCALES.AR]: 'ar-SY',
  [SUPPORTED_LOCALES.EN]: 'en',
} as const satisfies Record<SupportedLocale, string>;

export const LOCALE_INTL = {
  [SUPPORTED_LOCALES.AR]: 'ar-SY',
  [SUPPORTED_LOCALES.EN]: 'en-GB',
} as const satisfies Record<SupportedLocale, string>;

export const LOCALE_NUMBERING_SYSTEM = {
  [SUPPORTED_LOCALES.AR]: 'latn',
  [SUPPORTED_LOCALES.EN]: 'latn',
} as const satisfies Record<SupportedLocale, string>;

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (ALL_SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: SupportedLocale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function textDirection(locale: SupportedLocale): 'rtl' | 'ltr' {
  return LOCALE_DIRECTION[locale];
}

export function resolveLocale(requested: string | undefined | null): SupportedLocale {
  if (!requested) {
    return DEFAULT_LOCALE;
  }
  const base = requested.toLowerCase().split('-')[0] ?? '';
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

export interface CountryConfig {
  readonly isoCode: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly defaultCurrency: string;
  readonly defaultLocale: SupportedLocale;
  readonly defaultTimeZone: string;
  readonly phoneCountryCode: string;
  readonly active: boolean;
}

export const COUNTRY_CONFIGURATIONS = {
  SY: {
    isoCode: 'SY',
    nameEn: 'Syria',
    nameAr: 'سوريا',
    defaultCurrency: 'SYP',
    defaultLocale: SUPPORTED_LOCALES.AR,
    defaultTimeZone: 'Asia/Damascus',
    phoneCountryCode: '+963',
    active: true,
  },
} as const satisfies Record<string, CountryConfig>;

export const DEFAULT_COUNTRY = COUNTRY_CONFIGURATIONS.SY;
