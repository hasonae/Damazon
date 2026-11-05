/**
 * The Damazon API client.
 *
 * Responsibilities, as required by the frontend architecture:
 *
 * - **Authentication headers.** Attaches the bearer token from the injected
 *   `TokenStorage` and refreshes it once per request that fails with 401.
 * - **Error handling.** Normalizes every failure into `ApiRequestError`,
 *   `ApiTransportError`, or `ApiProtocolError`.
 * - **Request management.** Composes a per-request timeout with a
 *   caller-supplied `AbortSignal`.
 * - **Caching.** A small in-memory response cache for `GET` requests, opt-in per
 *   call, because the API is the source of truth and the client must not invent
 *   a longer-lived truth.
 * - **Retries.** Only for idempotent `GET` requests and only for transport
 *   failures. A 4xx or 5xx is never retried automatically, because a retried
 *   mutation is how a customer gets charged twice.
 */

import type {
  ApiErrorBody,
  ApiResponse,
  ApiResponseMeta,
  PaginatedResult,
} from '@damazon/shared-types';

import { ApiProtocolError, ApiRequestError, ApiTransportError } from './errors.js';
import {
  buildHeaders,
  buildPath,
  buildQueryString,
  type HttpMethod,
  type QueryParams,
} from './request.js';
import type { TokenPair, TokenStorage } from './token-storage.js';

export interface ApiClientOptions {
  /** Absolute base URL, for example `http://localhost:3000/api/v1`. */
  readonly baseUrl: string;
  readonly tokenStorage: TokenStorage;
  readonly fetchImpl?: typeof fetch;
  readonly defaultTimeoutMs?: number;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  /**
   * Performs a token refresh. Returns null when the session cannot be renewed, in
   * which case the caller is treated as signed out. Implementations issue
   * `POST /auth/refresh` with the refresh token supplied by the browser's cookie
   * jar, which JavaScript cannot read.
   */
  readonly refreshSession?: () => Promise<TokenPair | null>;
  readonly onUnauthenticated?: () => void;
}

export interface SendOptions<TSchema> {
  readonly method?: HttpMethod;
  readonly path: string;
  readonly pathParams?: Readonly<Record<string, string | number>>;
  readonly query?: QueryParams;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly anonymous?: boolean;
  readonly timeoutMs?: number;
  /**
   * Validates the success payload. Passing a Zod schema from
   * `@damazon/shared-types` turns a contract drift into a typed error at the
   * call site rather than a render crash further down the tree.
   */
  readonly schema?: TSchema;
  /** Cache key for a `GET`. Omit to bypass the cache. */
  readonly cacheKey?: string;
  readonly cacheTtlMs?: number;
}

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number;
}

/**
 * Result of a request that keeps the success envelope's metadata. On a
 * paginated response the server merges `limit`, `hasMore`, `nextCursor`, and
 * `totalCount` into that metadata, which plain `send` discards.
 */
export interface EnvelopedResult<TData> {
  readonly data: TData;
  readonly meta: ApiResponseMeta &
    Partial<
      Pick<PaginatedResult<never>['meta'], 'limit' | 'hasMore' | 'nextCursor' | 'totalCount'>
    >;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function combineSignals(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
): {
  signal: AbortSignal;
  done: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onCallerAbort = (): void => controller.abort();

  if (callerSignal !== undefined) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokenStorage: TokenStorage;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly defaultHeaders: Readonly<Record<string, string>>;
  private readonly refreshSession: (() => Promise<TokenPair | null>) | undefined;
  private readonly onUnauthenticated: (() => void) | undefined;
  private readonly cache = new Map<string, CacheEntry>();
  /** One in-flight refresh at a time, so parallel 401s cannot race. */
  private refreshInFlight: Promise<TokenPair | null> | null = null;

  public constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.tokenStorage = options.tokenStorage;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.refreshSession = options.refreshSession;
    this.onUnauthenticated = options.onUnauthenticated;
  }

  public get<TData = unknown, TSchema = unknown>(
    path: string,
    options: Omit<SendOptions<TSchema>, 'method' | 'path'> = {},
  ): Promise<TData> {
    return this.send<TData, TSchema>({ ...options, method: 'GET', path });
  }

  public post<TData = unknown, TSchema = unknown>(
    path: string,
    body?: unknown,
    options: Omit<SendOptions<TSchema>, 'method' | 'path' | 'body'> = {},
  ): Promise<TData> {
    return this.send<TData, TSchema>({ ...options, method: 'POST', path, body });
  }

  public put<TData = unknown, TSchema = unknown>(
    path: string,
    body?: unknown,
    options: Omit<SendOptions<TSchema>, 'method' | 'path' | 'body'> = {},
  ): Promise<TData> {
    return this.send<TData, TSchema>({ ...options, method: 'PUT', path, body });
  }

  public patch<TData = unknown, TSchema = unknown>(
    path: string,
    body?: unknown,
    options: Omit<SendOptions<TSchema>, 'method' | 'path' | 'body'> = {},
  ): Promise<TData> {
    return this.send<TData, TSchema>({ ...options, method: 'PATCH', path, body });
  }

  public delete<TData = unknown, TSchema = unknown>(
    path: string,
    options: Omit<SendOptions<TSchema>, 'method' | 'path'> = {},
  ): Promise<TData> {
    return this.send<TData, TSchema>({ ...options, method: 'DELETE', path });
  }

  public clearCache(prefix?: string): void {
    if (prefix === undefined) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public async send<TData = unknown, TSchema = unknown>(
    options: SendOptions<TSchema>,
  ): Promise<TData> {
    return (await this.sendFull<TData, TSchema>(options)).data;
  }

  /**
   * Performs a GET against a paginated route, returning the items together
   * with the page metadata (`hasMore`, `nextCursor`, `totalCount`) the server
   * merged into the success envelope. `send` intentionally drops that
   * metadata, so "load more" flows must use this method; caching is not
   * supported here because a cache entry would outlive its metadata.
   */
  public async getPaged<TItem>(
    path: string,
    options: Omit<SendOptions<never>, 'method' | 'path' | 'cacheKey' | 'schema'>,
  ): Promise<PaginatedResult<TItem>> {
    const { data, meta } = await this.sendFull<readonly TItem[], never>({
      ...options,
      method: 'GET',
      path,
    });

    return {
      items: data,
      meta: {
        limit: meta.limit ?? data.length,
        hasMore: meta.hasMore ?? false,
        nextCursor: meta.nextCursor ?? null,
        ...(meta.totalCount === undefined ? {} : { totalCount: meta.totalCount }),
      },
    };
  }

  private async sendFull<TData, TSchema>(
    options: SendOptions<TSchema>,
  ): Promise<EnvelopedResult<TData>> {
    const method = options.method ?? 'GET';
    const path = buildPath(options.path, options.pathParams);
    const url = `${this.baseUrl}${path}${buildQueryString(options.query)}`;

    if (method === 'GET' && options.cacheKey !== undefined) {
      const cached = this.readCache<TData>(options.cacheKey);
      if (cached !== undefined) {
        // A cache hit has no envelope; only `data` is observable through
        // `send`, so the synthetic metadata is never surfaced to callers.
        return {
          data: cached,
          meta: { requestId: 'cache', timestamp: new Date().toISOString() },
        };
      }
    }

    const { status, payload } = await this.execute<TData>(url, method, options);

    if (status === 401 && !options.anonymous && method === 'GET' && this.canRefresh()) {
      const refreshed = await this.performRefresh();

      if (refreshed !== null) {
        const retry = await this.execute<TData>(url, method, options);
        return this.finishFull<TData, TSchema>(retry.status, retry.payload, options);
      }
    }

    return this.finishFull<TData, TSchema>(status, payload, options);
  }

  private async execute<TData>(
    url: string,
    method: HttpMethod,
    options: Omit<SendOptions<unknown>, 'path'>,
  ): Promise<{ status: number; payload: ApiResponse<TData> }> {
    const accessToken = options.anonymous === true ? null : this.tokenStorage.readAccessToken();
    const headers = buildHeaders(this.defaultHeaders, options, accessToken);
    const { signal, done } = combineSignals(
      options.timeoutMs ?? this.defaultTimeoutMs,
      options.signal,
    );

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        signal,
        credentials: 'include',
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (cause) {
      const isAbort = cause instanceof Error && cause.name === 'AbortError';
      throw new ApiTransportError(
        isAbort ? `Request to ${url} was aborted or timed out` : `Network request to ${url} failed`,
        cause,
        isAbort,
      );
    } finally {
      done();
    }

    let payload: unknown;

    if (response.status === 204) {
      // A 204 carries no body by definition. Synthesising the success
      // envelope keeps DELETE-style endpoints (logout, zone removal,
      // favorites) from failing on `response.json()`.
      payload = {
        success: true,
        body: { data: null },
        meta: { requestId: 'n/a', timestamp: new Date().toISOString() },
      };
    } else {
      try {
        payload = await response.json();
      } catch (cause) {
        // A proxy error page or a truncated body is not an API error, so it is
        // reported as a protocol failure with the status attached.
        throw new ApiProtocolError(
          `Response from ${url} was not valid JSON (${String(cause)})`,
          response.status,
        );
      }
    }

    if (typeof payload !== 'object' || payload === null || !('success' in payload)) {
      throw new ApiProtocolError(
        `Response from ${url} did not match the API envelope`,
        response.status,
      );
    }

    return { status: response.status, payload: payload as ApiResponse<TData> };
  }

  private finishFull<TData, TSchema>(
    status: number,
    payload: ApiResponse<TData>,
    options: SendOptions<TSchema>,
  ): EnvelopedResult<TData> {
    if (payload.success) {
      const data = payload.body.data;

      if (options.cacheKey !== undefined) {
        const ttl = options.cacheTtlMs ?? 30_000;
        if (ttl > 0) {
          this.cache.set(options.cacheKey, { value: data, expiresAt: Date.now() + ttl });
        }
      }

      const validated =
        options.schema === undefined
          ? data
          : ((options.schema as { parse: (value: unknown) => TData }).parse(data) as TData);

      // On paginated routes the server merges `limit`/`hasMore`/`nextCursor`
      // into `body.meta`; the shared type only names requestId and timestamp,
      // so the extra fields are reinterpreted here instead of being dropped.
      const meta = (payload.body.meta ?? payload.meta) as EnvelopedResult<TData>['meta'];
      return { data: validated, meta };
    }

    if (payload.error.code === 'UNAUTHENTICATED' && options.anonymous !== true) {
      void this.tokenStorage.clearSession();
      this.tokenStorage.onSessionExpired?.();
      this.onUnauthenticated?.();
    }

    throw new ApiRequestError(payload.error as ApiErrorBody, status, payload.meta.requestId);
  }

  private readCache<TData>(key: string): TData | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as TData;
  }

  /**
   * The refresh token lives in an `HttpOnly` cookie rather than in JavaScript,
   * so this client cannot read it. Applications that can perform a refresh pass
   * `canRefresh` and implement `refreshSession`; applications without a refresh
   * capability never retry, and a 401 propagates to the sign-in screen.
   */
  private canRefresh(): boolean {
    return this.refreshSession !== undefined && this.tokenStorage.readAccessToken() !== null;
  }

  private performRefresh(): Promise<TokenPair | null> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    const attempt = (async (): Promise<TokenPair | null> => {
      try {
        const pair = await this.refreshSession?.();
        if (pair != null) {
          await this.tokenStorage.writeSession(pair);
        }
        return pair ?? null;
      } catch {
        await this.tokenStorage.clearSession();
        this.onUnauthenticated?.();
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    this.refreshInFlight = attempt;

    return attempt;
  }
}
