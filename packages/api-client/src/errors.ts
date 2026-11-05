/**
 * Error types raised by the API client.
 *
 * The client never throws raw `fetch` failures: it normalizes transport,
 * network, and application errors into a single shape so that calling code has
 * one branch to write and one type to narrow.
 */

import type { ApiErrorBody, ApiErrorCode, ApiFieldViolation } from '@damazon/shared-types';

/** The API responded, but with a non-2xx status. */
export class ApiRequestError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details: readonly ApiFieldViolation[];
  public readonly requestId: string | null;

  public constructor(body: ApiErrorBody, status: number, requestId: string | null) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.code = body.code;
    this.status = status;
    this.details = body.details ?? [];
    this.requestId = requestId ?? body.traceId ?? null;
  }

  /** True when re-authenticating is the only way forward. */
  public get isAuthenticationFailure(): boolean {
    return this.status === 401;
  }

  public get isAuthorizationFailure(): boolean {
    return this.status === 403;
  }

  public get isValidationFailure(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }

  /** Field-keyed messages, ready for a form to render. */
  public get fieldErrors(): Readonly<Record<string, string>> {
    const entries = this.details
      .filter((detail) => detail.field.startsWith('body.') || detail.field.startsWith('query.'))
      .map((detail) => {
        const separator = detail.field.indexOf('.');
        return [detail.field.slice(separator + 1), detail.message] as const;
      });

    return Object.fromEntries(entries);
  }
}

/** The request never produced a response: network failure, abort, or CORS. */
export class ApiTransportError extends Error {
  public override readonly cause: unknown;
  public readonly isAbort: boolean;

  public constructor(message: string, cause: unknown, isAbort = false) {
    super(message);
    this.name = 'ApiTransportError';
    this.cause = cause;
    this.isAbort = isAbort;
  }
}

/** The response arrived but did not match the documented envelope. */
export class ApiProtocolError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiProtocolError';
    this.status = status;
  }
}

export function isApiError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}
