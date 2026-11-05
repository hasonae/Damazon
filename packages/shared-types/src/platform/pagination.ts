export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

export interface PaginationQuery {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface PageMeta {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
  readonly totalCount?: number;
}

export interface PaginatedResult<TItem> {
  readonly items: readonly TItem[];
  readonly meta: PageMeta;
}

export function clampPageSize(limit: number | undefined | null): number {
  if (limit === undefined || limit === null || !Number.isFinite(limit)) {
    return DEFAULT_PAGE_SIZE;
  }
  const rounded = Math.trunc(limit);
  if (rounded < MIN_PAGE_SIZE) {
    return MIN_PAGE_SIZE;
  }
  return Math.min(rounded, MAX_PAGE_SIZE);
}

export function buildPage<TItem>(
  items: readonly TItem[],
  limit: number,
  hasMore: boolean,
  nextCursor: string | null,
  totalCount?: number,
): PaginatedResult<TItem> {
  return {
    items,
    meta: {
      limit,
      hasMore,
      nextCursor,
      ...(totalCount === undefined ? {} : { totalCount }),
    },
  };
}

export class InvalidCursorError extends Error {
  public constructor(cursor: string) {
    super(`Pagination cursor is not a valid cursor: ${cursor}`);
    this.name = 'InvalidCursorError';
  }
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(cursor));
  } catch {
    throw new InvalidCursorError(cursor);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidCursorError(cursor);
  }
  const { t, i } = parsed as { t?: unknown; i?: unknown };
  if (typeof t !== 'string' || typeof i !== 'string' || !i || Number.isNaN(Date.parse(t))) {
    throw new InvalidCursorError(cursor);
  }
  return { createdAt: t, id: i };
}

export function encodeCursor(createdAt: Date, id: string): string {
  return encodeURIComponent(JSON.stringify({ t: createdAt.toISOString(), i: id }));
}
