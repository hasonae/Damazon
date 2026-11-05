import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  MoneyError,
  addMoney,
  clampMoney,
  formatMoney,
  money,
  moneyFromMajor,
  multiplyMoney,
  percentageOf,
  subtractMoney,
  sumMoney,
  toMajorAmount,
} from '../src/commerce/money.js';

describe('money', () => {
  it('stores amounts as integer minor units and converts back to major units', () => {
    const price = moneyFromMajor(500, CURRENCIES.SYP);
    expect(price).toStrictEqual({ amountMinor: 50_000, currency: CURRENCIES.SYP });
    expect(toMajorAmount(price)).toBe(500);
  });

  it('rounds fractional major amounts instead of truncating them', () => {
    expect(moneyFromMajor(19.995, CURRENCIES.SYP).amountMinor).toBe(2_000);
  });

  it('rejects non-integer and unsafe minor amounts', () => {
    expect(() => money(10.5, CURRENCIES.SYP)).toThrow(MoneyError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 2, CURRENCIES.SYP)).toThrow(MoneyError);
  });

  it('rejects currencies that are registered but not enabled', () => {
    expect(() => moneyFromMajor(10, CURRENCIES.EUR)).toThrow(MoneyError);
  });

  it('adds, subtracts and sums amounts of the same currency', () => {
    const first = moneyFromMajor(100, CURRENCIES.SYP);
    const second = moneyFromMajor(250.5, CURRENCIES.SYP);
    expect(toMajorAmount(addMoney(first, second))).toBe(350.5);
    expect(toMajorAmount(subtractMoney(second, first))).toBe(150.5);
    expect(toMajorAmount(sumMoney([first, second, first], CURRENCIES.SYP))).toBe(450.5);
  });

  it('never mixes currencies silently', () => {
    expect(() =>
      addMoney(moneyFromMajor(1, CURRENCIES.SYP), moneyFromMajor(1, CURRENCIES.USD)),
    ).toThrow(MoneyError);
  });

  it('multiplies by whole quantities only', () => {
    expect(toMajorAmount(multiplyMoney(moneyFromMajor(12.5, CURRENCIES.SYP), 4))).toBe(50);
    expect(() => multiplyMoney(moneyFromMajor(12.5, CURRENCIES.SYP), 1.5)).toThrow(MoneyError);
    expect(() => multiplyMoney(moneyFromMajor(12.5, CURRENCIES.SYP), -1)).toThrow(MoneyError);
  });

  it('computes discounts and clamps values into a range', () => {
    expect(toMajorAmount(percentageOf(moneyFromMajor(1000, CURRENCIES.SYP), 15))).toBe(150);
    const minimum = moneyFromMajor(100, CURRENCIES.SYP);
    const maximum = moneyFromMajor(500, CURRENCIES.SYP);
    expect(toMajorAmount(clampMoney(moneyFromMajor(50, CURRENCIES.SYP), minimum, maximum))).toBe(
      100,
    );
    expect(toMajorAmount(clampMoney(moneyFromMajor(900, CURRENCIES.SYP), minimum, maximum))).toBe(
      500,
    );
    expect(toMajorAmount(clampMoney(moneyFromMajor(250, CURRENCIES.SYP), minimum, maximum))).toBe(
      250,
    );
  });

  it('formats amounts for both supported locales', () => {
    const value = money(123_456, CURRENCIES.SYP);
    expect(formatMoney(value, 'en-GB')).toBe('1,234.56 SYP');
    expect(formatMoney(value, 'ar-SY')).toContain('1,234.56');
  });
});
