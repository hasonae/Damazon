/**
 * Hooks shared across feature modules.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<TData> {
  readonly data: TData | null;
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly reload: () => void;
}

/**
 * Runs an async loader and exposes loading and error state.
 *
 * The request is discarded if the component unmounts or the inputs change first,
 * so a slow response cannot overwrite newer data. This is the pattern every
 * screen uses; wrapping it here keeps that guard in one place.
 */
export function useAsync<TData>(
  loader: () => Promise<TData>,
  deps: ReadonlyArray<unknown>,
): AsyncState<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError(null);

    void loader()
      .then((result) => {
        if (requestId.current === current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (requestId.current === current) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setIsLoading(false);
        }
      });
    // `loader` is intentionally excluded: callers pass an inline closure, and
    // `deps` is the declared dependency list for this call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, isLoading, reload };
}

/** Tracks a media query, used for the phone/tablet branch in dense layouts. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);

    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True when the browser reports no connectivity. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = (): void => setIsOnline(true);
    const goOffline = (): void => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
