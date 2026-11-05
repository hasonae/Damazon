/**
 * Staff session state for the administrative console.
 *
 * Two properties distinguish this from the customer session:
 *
 * 1. Authority comes from `adminDepartments`, and an account with no department
 *    membership has no administrative permissions at all (ADR-0006). The console
 *    reflects that by refusing to render any screen rather than rendering an
 *    empty one.
 * 2. Sessions idle out. A console left open on an unattended workstation is a
 *    real risk, so the session is cleared after a configurable idle period and on
 *    visibility loss beyond the threshold.
 *
 * The access token is held in memory only and is never persisted to storage.
 */

import { DamazonClient } from '@damazon/api-client';
import type { AuthenticatedUser, TokenPair, TokenStorage } from '@damazon/api-client';
import { USER_ROLES, type AdminDepartment, type Permission } from '@damazon/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { runtimeConfig } from '../config/runtime.js';

export type ConsoleStatus = 'loading' | 'authenticated' | 'anonymous' | 'forbidden';

export interface ConsoleSessionState {
  readonly status: ConsoleStatus;
  readonly user: AuthenticatedUser | null;
  readonly departments: readonly AdminDepartment[];
  readonly permissions: readonly Permission[];
}

const INITIAL: ConsoleSessionState = {
  status: 'loading',
  user: null,
  departments: [],
  permissions: [],
};

export interface ConsoleSessionValue extends ConsoleSessionState {
  readonly client: DamazonClient;
  readonly signIn: (identifier: string, password: string) => Promise<void>;
  readonly startPasswordRecovery: (identifier: string) => Promise<string>;
  readonly signOut: () => Promise<void>;
  /** Affordance only. The API is the enforcement boundary. */
  readonly can: (permission: string) => boolean;
  readonly canAny: (...permissions: readonly string[]) => boolean;
}

const ConsoleSessionContext = createContext<ConsoleSessionValue | null>(null);

class ConsoleTokenStorage implements TokenStorage {
  private accessToken: string | null = null;

  public readAccessToken(): string | null {
    return this.accessToken;
  }

  public async writeSession(pair: TokenPair): Promise<void> {
    this.accessToken = pair.accessToken;
  }

  public async clearSession(): Promise<void> {
    this.accessToken = null;
  }
}

function toState(user: AuthenticatedUser): ConsoleSessionState {
  const departments = user.adminDepartments;
  const hasDepartment = departments.length > 0;

  return {
    // A signed-in account with no department is authenticated but not authorized.
    // Separating the two states keeps the sign-in screen from claiming the
    // credentials were wrong.
    status: hasDepartment ? 'authenticated' : 'forbidden',
    user,
    departments,
    permissions: hasDepartment ? (user.permissions as readonly Permission[]) : [],
  };
}

export function ConsoleSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const tokenStorage = useMemo(() => new ConsoleTokenStorage(), []);
  const signOutRef = useRef<(() => Promise<void>) | null>(null);

  const client = useMemo(
    () =>
      new DamazonClient({
        baseUrl: runtimeConfig.apiBaseUrl,
        tokenStorage,
        onUnauthenticated: () => setState({ ...INITIAL, status: 'anonymous' }),
      }),
    [tokenStorage],
  );

  const [state, setState] = useState<ConsoleSessionState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const session = await client.auth.refresh();
        await tokenStorage.writeSession(session);
        let user = await client.auth.me();
        if (user.roles.includes(USER_ROLES.ADMIN) && user.activeRole !== USER_ROLES.ADMIN) {
          const adminSession = await client.auth.switchRole(USER_ROLES.ADMIN);
          await tokenStorage.writeSession(adminSession);
          user = adminSession.user;
        }
        if (!cancelled) {
          setState(toState(user));
        }
      } catch {
        await tokenStorage.clearSession();
        if (!cancelled) {
          setState({ ...INITIAL, status: 'anonymous' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, tokenStorage]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await client.auth.logout();
    } finally {
      await tokenStorage.clearSession();
      setState({ ...INITIAL, status: 'anonymous' });
    }
  }, [client, tokenStorage]);

  signOutRef.current = signOut;

  // Idle timeout: any interaction resets the timer, so an actively used console
  // is never logged out from under the operator.
  useEffect(() => {
    if (state.status !== 'authenticated') {
      return;
    }

    const limitMs = runtimeConfig.idleSignOutMinutes * 60_000;
    let timer = window.setTimeout(() => void signOutRef.current?.(), limitMs);

    const reset = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void signOutRef.current?.(), limitMs);
    };

    const events: readonly string[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const event of events) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, reset);
      }
    };
  }, [state.status]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<void> => {
      const session = await client.auth.login({ identifier, password });
      await tokenStorage.writeSession(session);
      if (!session.user.roles.includes(USER_ROLES.ADMIN)) {
        setState(toState(session.user));
        return;
      }
      const adminSession = await client.auth.switchRole(USER_ROLES.ADMIN);
      await tokenStorage.writeSession(adminSession);
      setState(toState(adminSession.user));
    },
    [client, tokenStorage],
  );

  const startPasswordRecovery = useCallback(
    async (identifier: string): Promise<string> => {
      const result = await client.auth.startPasswordRecovery(identifier);
      return result.challengeId;
    },
    [client],
  );

  const can = useCallback(
    (permission: string): boolean => state.permissions.includes(permission as Permission),
    [state.permissions],
  );

  const canAny = useCallback(
    (...permissions: readonly string[]): boolean =>
      permissions.some((permission) => can(permission)),
    [can],
  );

  const value = useMemo<ConsoleSessionValue>(
    () => ({
      ...state,
      client,
      signIn,
      startPasswordRecovery,
      signOut,
      can,
      canAny,
    }),
    [state, client, signIn, startPasswordRecovery, signOut, can, canAny],
  );

  return <ConsoleSessionContext.Provider value={value}>{children}</ConsoleSessionContext.Provider>;
}

export function useConsoleSession(): ConsoleSessionValue {
  const value = useContext(ConsoleSessionContext);

  if (value === null) {
    throw new Error('useConsoleSession must be used inside a ConsoleSessionProvider');
  }

  return value;
}
