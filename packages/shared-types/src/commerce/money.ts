export const CURRENCIES = {
  SYP: 'SYP',
  USD: 'USD',
  EUR: 'EUR',
  TRY: 'TRY',
  AED: 'AED',
  SAR: 'SAR',
  JOD: 'JOD',
} as const;

export type CurrencyCode = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly minorUnitDigits: number;
  readonly symbol: string;
  readonly symbolAr: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly supported: boolean;
}

export const CURRENCY_DEFINITIONS = {
  [CURRENCIES.SYP]: {
    code: CURRENCIES.SYP,
    minorUnitDigits: 2,
    symbol: 'SYP',
    symbolAr: 'ل.س',
    nameEn: 'Syrian Pound',
    nameAr: 'ليرة سورية',
    supported: true,
  },
  [CURRENCIES.USD]: {
    code: CURRENCIES.USD,
    minorUnitDigits: 2,
    symbol: '$',
    symbolAr: '$',
    nameEn: 'US Dollar',
    nameAr: 'دولار أمريكي',
    supported: true,
  },
  [CURRENCIES.EUR]: {
    code: CURRENCIES.EUR,
    minorUnitDigits: 2,
    symbol: '€',
    symbolAr: '€',
    nameEn: 'Euro',
    nameAr: 'أورو',
    supported: false,
  },
  [CURRENCIES.TRY]: {
    code: CURRENCIES.TRY,
    minorUnitDigits: 2,
    symbol: '₺',
    symbolAr: '₺',
    nameEn: 'Turkish Lira',
    nameAr: 'ليرة تركية',
    supported: false,
  },
  [CURRENCIES.AED]: {
    code: CURRENCIES.AED,
    minorUnitDigits: 2,
    symbol: 'AED',
    symbolAr: 'د.إ',
    nameEn: 'UAE Dirham',
    nameAr: 'درهم إماراتي',
    supported: false,
  },
  [CURRENCIES.SAR]: {
    code: CURRENCIES.SAR,
    minorUnitDigits: 2,
    symbol: 'SAR',
    symbolAr: 'ر.س',
    nameEn: 'Saudi Riyal',
    nameAr: 'ريال سعودي',
    supported: false,
  },
  [CURRENCIES.JOD]: {
    code: CURRENCIES.JOD,
    minorUnitDigits: 3,
    symbol: 'JOD',
    symbolAr: 'د.أ',
    nameEn: 'Jordanian Dinar',
    nameAr: 'دينار أردني',
    supported: false,
  },
} as const satisfies Record<CurrencyCode, CurrencyDefinition>;

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCY_DEFINITIONS;
}

export function minorUnitDigits(currency: CurrencyCode): number {
  return CURRENCY_DEFINITIONS[currency].minorUnitDigits;
}

export function assertSafeMinorAmount(amountMinor: number, currency: CurrencyCode): void {
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(`Money amount must be an integer number of minor units: ${amountMinor}`);
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Money amount exceeds safe integer range: ${amountMinor}`);
  }
  if (CURRENCY_DEFINITIONS[currency].supported === false) {
    throw new MoneyError(`Currency ${currency} is registered but not enabled for commerce`);
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  assertSafeMinorAmount(amountMinor, currency);
  return { amountMinor, currency };
}

export function moneyFromMajor(majorAmount: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(majorAmount)) {
    throw new MoneyError(`Money amount must be finite: ${majorAmount}`);
  }
  const factor = 10 ** minorUnitDigits(currency);
  const amountMinor = Math.round(majorAmount * factor);
  assertSafeMinorAmount(amountMinor, currency);
  return { amountMinor, currency };
}

export function toMajorAmount(value: Money): number {
  return value.amountMinor / 10 ** minorUnitDigits(value.currency);
}

export function zeroMoney(currency: CurrencyCode): Money {
  return { amountMinor: 0, currency };
}

export function isSameCurrency(left: Money, right: Money): boolean {
  return left.currency === right.currency;
}

function requireSameCurrency(left: Money, right: Money): void {
  if (!isSameCurrency(left, right)) {
    throw new MoneyError(`Currency mismatch: ${left.currency} vs ${right.currency}`);
  }
}

export function addMoney(left: Money, right: Money): Money {
  requireSameCurrency(left, right);
  const sum = left.amountMinor + right.amountMinor;
  assertSafeMinorAmount(sum, left.currency);
  return { amountMinor: sum, currency: left.currency };
}

export function subtractMoney(left: Money, right: Money): Money {
  requireSameCurrency(left, right);
  const difference = left.amountMinor - right.amountMinor;
  assertSafeMinorAmount(difference, left.currency);
  return { amountMinor: difference, currency: left.currency };
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative integer: ${quantity}`);
  }
  const product = value.amountMinor * quantity;
  assertSafeMinorAmount(product, value.currency);
  return { amountMinor: product, currency: value.currency };
}

export function percentageOf(value: Money, percent: number): Money {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new MoneyError(`Percentage must be a non-negative finite number: ${percent}`);
  }
  const result = Math.round((value.amountMinor * percent) / 100);
  assertSafeMinorAmount(result, value.currency);
  return { amountMinor: result, currency: value.currency };
}

export function sumMoney(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce<Money>((total, value) => addMoney(total, value), zeroMoney(currency));
}

export function maxMoney(left: Money, right: Money): Money {
  requireSameCurrency(left, right);
  return left.amountMinor >= right.amountMinor ? left : right;
}

export function minMoney(left: Money, right: Money): Money {
  requireSameCurrency(left, right);
  return left.amountMinor <= right.amountMinor ? left : right;
}

export function clampMoney(value: Money, minimum: Money, maximum: Money): Money {
  return maxMoney(minMoney(value, maximum), minimum);
}

export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
  requireSameCurrency(left, right);
  if (left.amountMinor < right.amountMinor) {
    return -1;
  }
  return left.amountMinor > right.amountMinor ? 1 : 0;
}

export function moneyEquals(left: Money, right: Money): boolean {
  return compareMoney(left, right) === 0;
}

export function formatMoney(
  value: Money,
  locale = 'ar-SY',
  options?: Intl.NumberFormatOptions,
): string {
  const digits = minorUnitDigits(value.currency);
  const amount = toMajorAmount(value);
  const formatter = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...options,
  });
  return `${formatter.format(amount)} ${CURRENCY_DEFINITIONS[value.currency].symbol}`;
}

export function serializeMoney(value: Money): { amountMinor: number; currency: CurrencyCode } {
  return { amountMinor: value.amountMinor, currency: value.currency };
}
