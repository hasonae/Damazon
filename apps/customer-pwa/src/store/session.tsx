/**
 * Session state for the customer PWA.
 *
 * The access token is held in memory only. The refresh token is an `HttpOnly`
 * cookie the API sets, so it is never readable by JavaScript and never written
 * to `localStorage`; this module only knows that a session exists. That is why
 * the store is written with a context provider rather than a global singleton:
 * clearing memory on sign-out has to be observable by the whole tree at once.
 */

import { DamazonClient } from '@damazon/api-client';
import type {
  AuthenticatedUser,
  EmailVerificationPending,
  TokenPair,
  TokenStorage,
} from '@damazon/api-client';
import type { AdminDepartment, UserRole } from '@damazon/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { runtimeConfig } from '../config/runtime.js';

interface SessionState {
  readonly status: 'loading' | 'authenticated' | 'anonymous';
  readonly user: AuthenticatedUser | null;
  readonly roles: readonly UserRole[];
  readonly activeRole: UserRole | null;
  readonly activeBusinessId: string | null;
  readonly adminDepartments: readonly AdminDepartment[];
  readonly permissions: readonly string[];
}

const INITIAL_STATE: SessionState = {
  status: 'loading',
  user: null,
  roles: [],
  activeRole: null,
  activeBusinessId: null,
  adminDepartments: [],
  permissions: [],
};

export interface SessionContextValue extends SessionState {
  readonly client: DamazonClient;
  readonly signIn: (identifier: string, password: string) => Promise<void>;
  readonly startPasswordRecovery: (identifier: string) => Promise<string>;
  readonly completePasswordRecovery: (
    challengeId: string,
    token: string,
    newPassword: string,
  ) => Promise<void>;
  readonly register: (input: {
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    email: string;
  }) => Promise<EmailVerificationPending>;
  readonly verifyEmail: (challengeId: string, token: string) => Promise<void>;
  readonly resendEmailVerification: (email: string) => Promise<void>;
  readonly signOut: (allDevices?: boolean) => Promise<void>;
  readonly switchRole: (role: UserRole) => Promise<void>;
  /** Client-side affordance only. The API remains the enforcement boundary. */
  readonly can: (permission: string) => boolean;
  readonly hasRole: (role: UserRole) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Access token lives only in this closure; nothing persists it. */
class InMemorySessionStorage implements TokenStorage {
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

function toState(user: AuthenticatedUser): SessionState {
  return {
    status: 'authenticated',
    user,
    roles: user.roles,
    activeRole: user.activeRole,
    activeBusinessId: user.activeBusinessId,
    adminDepartments: user.adminDepartments,
    permissions: user.permissions,
  };
}

export function SessionProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const tokenStorage = useMemo(() => new InMemorySessionStorage(), []);

  const client = useMemo(
    () =>
      new DamazonClient({
        baseUrl: runtimeConfig.apiBaseUrl,
        tokenStorage,
        onUnauthenticated: () => setState({ ...INITIAL_STATE, status: 'anonymous' }),
      }),
    [tokenStorage],
  );

  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // Restore the in-memory access token from the HttpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const session = await client.auth.refresh();
        await tokenStorage.writeSession(session);
        const user = await client.auth.me();
        if (!cancelled) {
          setState(toState(user));
        }
      } catch {
        await tokenStorage.clearSession();
        if (!cancelled) {
          setState({ ...INITIAL_STATE, status: 'anonymous' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, tokenStorage]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<void> => {
      const session = await client.auth.login({ identifier, password });
      await tokenStorage.writeSession(session);
      setState(toState(session.user));
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

  const completePasswordRecovery = useCallback(
    async (challengeId: string, token: string, newPassword: string): Promise<void> => {
      await client.auth.completePasswordRecovery({ challengeId, token, newPassword });
      await tokenStorage.clearSession();
      setState({ ...INITIAL_STATE, status: 'anonymous' });
    },
    [client, tokenStorage],
  );

  const register = useCallback(
    async (input: {
      phone: string;
      password: string;
      firstName: string;
      lastName: string;
      email: string;
    }): Promise<EmailVerificationPending> => {
      return client.auth.register(input);
    },
    [client],
  );

  const verifyEmail = useCallback(
    async (challengeId: string, token: string): Promise<void> => {
      const session = await client.auth.verifyEmail(challengeId, token);
      await tokenStorage.writeSession(session);
      setState(toState(session.user));
    },
    [client, tokenStorage],
  );

  const resendEmailVerification = useCallback(
    async (email: string): Promise<void> => {
      await client.auth.resendEmailVerification(email);
    },
    [client],
  );

  const signOut = useCallback(
    async (allDevices = false): Promise<void> => {
      try {
        if (allDevices) {
          await client.auth.logoutAll();
        } else {
          await client.auth.logout();
        }
      } finally {
        await tokenStorage.clearSession();
        setState({ ...INITIAL_STATE, status: 'anonymous' });
      }
    },
    [client, tokenStorage],
  );

  const switchRole = useCallback(
    async (role: UserRole): Promise<void> => {
      const session = await client.auth.switchRole(role);
      // A role switch mints a new access token; keeping the previous one would
      // leave the UI showing a mode the token cannot act in.
      await tokenStorage.writeSession(session);
      setState(toState(session.user));
    },
    [client, tokenStorage],
  );

  const can = useCallback(
    (permission: string): boolean => state.permissions.includes(permission),
    [state.permissions],
  );

  const hasRole = useCallback(
    (role: UserRole): boolean => state.roles.includes(role),
    [state.roles],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      client,
      signIn,
      startPasswordRecovery,
      completePasswordRecovery,
      register,
      verifyEmail,
      resendEmailVerification,
      signOut,
      switchRole,
      can,
      hasRole,
    }),
    [
      state,
      client,
      signIn,
      startPasswordRecovery,
      completePasswordRecovery,
      register,
      verifyEmail,
      resendEmailVerification,
      signOut,
      switchRole,
      can,
      hasRole,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);

  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }

  return value;
}
