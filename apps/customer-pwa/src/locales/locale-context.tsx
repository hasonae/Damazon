/**
 * Locale context.
 *
 * Arabic is the default. Switching the locale sets `dir` on the document element
 * because layout depends on direction, not only on text content.
 */

import type { SupportedLocale } from '@damazon/shared-types';
import { RTL_LOCALES } from '@damazon/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createTranslator, type StringKey, type Translator } from '../locales/strings.js';

export interface LocaleContextValue {
  readonly locale: SupportedLocale;
  readonly direction: 'rtl' | 'ltr';
  readonly t: Translator;
  readonly setLocale: (locale: SupportedLocale) => void;
  /** Formats integer minor units for display. Digits stay Latin in both locales. */
  readonly formatMoney: (minorUnits: string | bigint, currency?: string) => string;
  readonly formatNumber: (value: number) => string;
  readonly formatDateTime: (value: string | Date) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'damazon:preferences:locale';

function readStoredLocale(fallback: SupportedLocale): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'ar' || stored === 'en' ? stored : fallback;
  } catch {
    return fallback;
  }
}

function applyDocumentDirection(locale: SupportedLocale): void {
  const isRtl = (RTL_LOCALES as readonly string[]).includes(locale);
  const direction = isRtl ? 'rtl' : 'ltr';

  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
}

export function LocaleProvider({
  children,
  defaultLocale = 'ar',
}: {
  readonly children: ReactNode;
  readonly defaultLocale?: SupportedLocale;
}): JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => readStoredLocale(defaultLocale));

  useEffect(() => {
    applyDocumentDirection(locale);
  }, [locale]);

  const setLocale = useCallback((next: SupportedLocale): void => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A failed write only costs persistence; the session keeps the new locale.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const intlLocale = locale === 'ar' ? 'ar-SY' : 'en-US';

    // Arabic in Syria conventionally uses Latin ("Western Arabic") digits, and
    // the requirement fixes Latin digits for money, so `latn` is pinned for both.
    const numberFormat = new Intl.NumberFormat(intlLocale, {
      numberingSystem: 'latn',
      maximumFractionDigits: 0,
    });

    const dateFormat = new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      numberingSystem: 'latn',
    });

    return {
      locale,
      direction: (RTL_LOCALES as readonly string[]).includes(locale) ? 'rtl' : 'ltr',
      t: createTranslator(locale),
      setLocale,
      formatMoney: (minorUnits, currency = 'SYP') => {
        const value = typeof minorUnits === 'bigint' ? minorUnits : BigInt(minorUnits);
        // SYP has no circulating minor unit, so the amount is displayed as-is.
        return `${numberFormat.format(value)} ${currency === 'SYP' ? 'ل.س' : currency}`;
      },
      formatNumber: (input: number) => numberFormat.format(input),
      formatDateTime: (input) =>
        dateFormat.format(typeof input === 'string' ? new Date(input) : input),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);

  if (value === null) {
    throw new Error('useLocale must be used inside a LocaleProvider');
  }

  return value;
}

export type { StringKey };
