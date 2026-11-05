export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export interface RetryOptions {
  readonly attempts: number;
  readonly initialDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export const DEFAULT_RETRY_OPTIONS = {
  attempts: 3,
  initialDelayMs: 200,
  backoffMultiplier: 2,
  maxDelayMs: 5_000,
} as const satisfies RetryOptions;

export async function retry<TValue>(
  operation: (attempt: number) => Promise<TValue>,
  options: Partial<RetryOptions> = {},
): Promise<TValue> {
  const resolved = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  for (let attempt = 1; attempt <= resolved.attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const retryable = resolved.shouldRetry ? resolved.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === resolved.attempts) {
        break;
      }
      const delay = Math.min(
        resolved.initialDelayMs * resolved.backoffMultiplier ** (attempt - 1),
        resolved.maxDelayMs,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

export function chunk<TItem>(items: readonly TItem[], size: number): TItem[][] {
  if (size <= 0) {
    throw new RangeError(`Chunk size must be positive, received ${size}`);
  }
  const chunks: TItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
