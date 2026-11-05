/**
 * Offline storage.
 *
 * The architecture requires that preferences, recently viewed reference data,
 * recent searches, draft orders, and pending actions survive a reload or a lost
 * connection. Storage is behind an interface so tests and server-side rendering
 * can substitute an in-memory implementation, and so a future encryption layer
 * has one place to attach.
 */

const PREFIX = 'damazon:';

export type OfflineNamespace =
  'preferences' | 'searches' | 'draft-cart' | 'pending-actions' | 'cached-reference';

export interface OfflineStore {
  read<T>(namespace: OfflineNamespace, key: string): T | null;
  write<T>(namespace: OfflineNamespace, key: string, value: T): void;
  remove(namespace: OfflineNamespace, key: string): void;
  clear(namespace: OfflineNamespace): void;
  keys(namespace: OfflineNamespace): readonly string[];
}

function storageKey(namespace: OfflineNamespace, key: string): string {
  return `${PREFIX}${namespace}:${key}`;
}

/**
 * localStorage-backed store. Every access is guarded: a private-mode browser can
 * throw on both read and write, and a full quota can throw on write. A failure
 * degrades to "no cached value" rather than breaking the screen.
 */
export const browserOfflineStore: OfflineStore = {
  read<T>(namespace: OfflineNamespace, key: string): T | null {
    try {
      const raw = window.localStorage.getItem(storageKey(namespace, key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  write<T>(namespace: OfflineNamespace, key: string, value: T): void {
    try {
      window.localStorage.setItem(storageKey(namespace, key), JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled: the in-memory state stays correct.
    }
  },

  remove(namespace: OfflineNamespace, key: string): void {
    try {
      window.localStorage.removeItem(storageKey(namespace, key));
    } catch {
      // Nothing to do: a failed removal leaves a stale value that read() can
      // still tolerate.
    }
  },

  clear(namespace: OfflineNamespace): void {
    for (const key of this.keys(namespace)) {
      this.remove(namespace, key);
    }
  },

  keys(namespace: OfflineNamespace): readonly string[] {
    try {
      const prefix = `${PREFIX}${namespace}:`;
      return Object.keys(window.localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    } catch {
      return [];
    }
  },
};

/** In-memory store used by tests and by any environment without `localStorage`. */
export const memoryOfflineStore: OfflineStore = (() => {
  const entries = new Map<string, string>();

  return {
    read<T>(namespace: OfflineNamespace, key: string): T | null {
      const raw = entries.get(storageKey(namespace, key));
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    write<T>(namespace: OfflineNamespace, key: string, value: T): void {
      entries.set(storageKey(namespace, key), JSON.stringify(value));
    },
    remove(namespace: OfflineNamespace, key: string): void {
      entries.delete(storageKey(namespace, key));
    },
    clear(namespace: OfflineNamespace): void {
      for (const [key] of entries) {
        if (key.startsWith(`${PREFIX}${namespace}:`)) {
          entries.delete(key);
        }
      }
    },
    keys(namespace: OfflineNamespace): readonly string[] {
      const prefix = `${PREFIX}${namespace}:`;
      return [...entries.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    },
  };
})();

/** Most recent search terms, newest first, capped so the list cannot grow forever. */
export const RECENT_SEARCH_LIMIT = 10;

export function recordRecentSearches(store: OfflineStore, term: string): readonly string[] {
  const trimmed = term.trim();

  if (trimmed.length === 0) {
    return store.read<readonly string[]>('searches', 'recent') ?? [];
  }

  const existing = store.read<readonly string[]>('searches', 'recent') ?? [];
  const next = [trimmed, ...existing.filter((entry) => entry !== trimmed)].slice(
    0,
    RECENT_SEARCH_LIMIT,
  );

  store.write('searches', 'recent', next);

  return next;
}

export function readRecentSearches(store: OfflineStore): readonly string[] {
  return store.read<readonly string[]>('searches', 'recent') ?? [];
}

export function clearRecentSearches(store: OfflineStore): void {
  store.clear('searches');
}
