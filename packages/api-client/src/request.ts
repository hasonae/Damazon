/**
 * Request construction for the Damazon API client.
 *
 * Query serialization, path interpolation, and header assembly live here so that
 * every endpoint module builds a request the same way. In particular, monetary
 * values are never serialized as numbers: the API expects decimal strings, so
 * `BigInt` and string amounts pass through untouched.
 */

import { clampPageSize, type PaginationQuery } from '@damazon/shared-types';

export type QueryValue = string | number | boolean | bigint | null | undefined;

export type QueryParams = Readonly<Record<string, QueryValue>>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  readonly method?: HttpMethod;
  readonly path: string;
  readonly query?: QueryParams;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  /** Caller-supplied cancellation, composed with the client's timeout signal. */
  readonly signal?: AbortSignal;
  /** Skips the Authorization header. Used by login and registration. */
  readonly anonymous?: boolean;
  /** Overrides the client default for this request. */
  readonly timeoutMs?: number;
}

/** Appends query parameters, omitting `undefined` and `null`. */
export function buildQueryString(params: QueryParams | undefined): string {
  if (params === undefined) {
    return '';
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    // BigInt cannot be stringified implicitly; money arrives as a decimal
    // string, but an explicit BigInt must survive serialization intact.
    search.append(key, typeof value === 'bigint' ? value.toString() : String(value));
  }

  const query = search.toString();

  return query.length > 0 ? `?${query}` : '';
}

/**
 * Replaces `{name}` placeholders in a path with encoded values and throws when
 * a placeholder has no corresponding value, so a missing id fails loudly rather
 * than producing a request to `/orders/undefined`.
 */
export function buildPath(
  template: string,
  params: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
    const value = params[key];

    if (value === undefined) {
      throw new Error(`Missing path parameter "${key}" for "${template}"`);
    }

    return encodeURIComponent(String(value));
  });
}

export function paginationParams(pagination: PaginationQuery | undefined): QueryParams {
  if (pagination === undefined) {
    return {};
  }

  return {
    limit: clampPageSize(pagination.limit),
    cursor: pagination.cursor,
  };
}

export function buildHeaders(
  base: Readonly<Record<string, string>>,
  options: Pick<RequestOptions, 'headers' | 'anonymous' | 'body'>,
  accessToken: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...base,
    ...options.headers,
  };

  if (!options.anonymous && accessToken !== null) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}
