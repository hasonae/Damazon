import { describe, expect, it } from 'vitest';

import {
  combineResults,
  err,
  flatMapResult,
  isErr,
  isOk,
  mapResult,
  ok,
  unwrapOr,
} from '../src/result.js';

describe('result', () => {
  it('narrows success and failure with type guards', () => {
    const success = ok(5);
    const failure = err<string>('boom');
    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(unwrapOr(failure, 0)).toBe(0);
    expect(unwrapOr(success, 0)).toBe(5);
  });

  it('maps only the success branch', () => {
    expect(mapResult(ok(2), (value) => value * 3)).toStrictEqual(ok(6));
    expect(mapResult(err<string>('boom'), (value: number) => value * 3)).toStrictEqual(err('boom'));
  });

  it('short circuits on the first failure when combining', () => {
    expect(combineResults([ok(1), ok(2)])).toStrictEqual(ok([1, 2]));
    expect(combineResults([ok(1), err('first'), err('second')])).toStrictEqual(err('first'));
  });

  it('chains with flatMapResult', () => {
    expect(flatMapResult(ok(2), (value) => ok(value + 1))).toStrictEqual(ok(3));
    expect(flatMapResult(ok(2), (value) => err(`${value}`))).toStrictEqual(err('2'));
  });
});
