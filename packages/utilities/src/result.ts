export type Ok<TValue> = { readonly ok: true; readonly value: TValue };
export type Err<TError> = { readonly ok: false; readonly error: TError };
export type Result<TValue, TError> = Ok<TValue> | Err<TError>;

export function ok<TValue>(value: TValue): Ok<TValue> {
  return { ok: true, value };
}

export function err<TError>(error: TError): Err<TError> {
  return { ok: false, error };
}

export function isOk<TValue, TError>(result: Result<TValue, TError>): result is Ok<TValue> {
  return result.ok;
}

export function isErr<TValue, TError>(result: Result<TValue, TError>): result is Err<TError> {
  return !result.ok;
}

export function unwrapOr<TValue, TError>(result: Result<TValue, TError>, fallback: TValue): TValue {
  return result.ok ? result.value : fallback;
}

export function mapResult<TValue, TError, TNext>(
  result: Result<TValue, TError>,
  transform: (value: TValue) => TNext,
): Result<TNext, TError> {
  return result.ok ? ok(transform(result.value)) : result;
}

export function flatMapResult<TValue, TError, TNext>(
  result: Result<TValue, TError>,
  transform: (value: TValue) => Result<TNext, TError>,
): Result<TNext, TError> {
  return result.ok ? transform(result.value) : result;
}

export function combineResults<TValue, TError>(
  results: readonly Result<TValue, TError>[],
): Result<TValue[], TError> {
  const values: TValue[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}
