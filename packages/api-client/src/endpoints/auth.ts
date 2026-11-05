/**
 * Endpoint groups for the authentication domain.
 *
 * Each method maps to one documented route and returns the unwrapped success
 * payload. Signatures reuse the shared contracts, so a change to a request or
 * response shape breaks the compiler here rather than at runtime in a screen.
 */

import type { AdminDepartment, SupportedLocale, UserRole } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';
import type { TokenPair } from '../token-storage.js';

/** Identifiers are opaque UUID strings; they are never parsed or reformatted. */
type BusinessId = string;
type LocaleCode = SupportedLocale;
/** Every role an account may hold, including roles not yet active. */
type ActiveRole = UserRole;

export interface AuthenticatedUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly locale: LocaleCode;
  readonly status: string;
  readonly roles: readonly UserRole[];
  readonly activeRole: ActiveRole;
  readonly activeBusinessId: BusinessId | null;
  readonly adminDepartments: readonly AdminDepartment[];
  readonly permissions: readonly string[];
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
  readonly createdAt: string;
}

export interface SessionPayload {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly sessionId: string;
  readonly user: AuthenticatedUser;
}

export interface RegisterRequest {
  readonly phone: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly locale?: LocaleCode;
}

export interface EmailVerificationPending {
  readonly email: string;
  readonly expiresInSeconds: number;
}

export interface LoginRequest {
  /** Phone in any accepted local or E.164 form, or an email address. */
  readonly identifier: string;
  readonly password: string;
}

export interface PasswordRecoveryStarted {
  readonly accepted: true;
  readonly challengeId: string;
}

export interface CompletePasswordRecoveryRequest {
  readonly challengeId: string;
  readonly token: string;
  readonly newPassword: string;
}

export class AuthApi {
  private refreshInFlight: Promise<TokenPair> | null = null;

  public constructor(private readonly client: ApiClient) {}

  public async register(request: RegisterRequest): Promise<EmailVerificationPending> {
    return this.client.post<EmailVerificationPending>('/auth/register', request, {
      anonymous: true,
    });
  }

  public async verifyEmail(challengeId: string, token: string): Promise<SessionPayload> {
    return this.client.post<SessionPayload>(
      '/auth/verify-email',
      { challengeId, token },
      {
        anonymous: true,
      },
    );
  }

  public async resendEmailVerification(email: string): Promise<void> {
    await this.client.post('/auth/resend-email-verification', { email }, { anonymous: true });
  }

  public async login(request: LoginRequest): Promise<SessionPayload> {
    return this.client.post<SessionPayload>('/auth/login', request, { anonymous: true });
  }

  public async startPasswordRecovery(identifier: string): Promise<PasswordRecoveryStarted> {
    return this.client.post<PasswordRecoveryStarted>(
      '/auth/password-recovery/start',
      { identifier },
      { anonymous: true },
    );
  }

  public async completePasswordRecovery(request: CompletePasswordRecoveryRequest): Promise<void> {
    await this.client.post('/auth/password-recovery/complete', request, { anonymous: true });
  }

  public refresh(): Promise<TokenPair> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    const attempt = (async (): Promise<TokenPair> => {
      try {
        return await this.client.post<TokenPair>('/auth/refresh', undefined, { anonymous: true });
      } finally {
        this.refreshInFlight = null;
      }
    })();
    this.refreshInFlight = attempt;
    return attempt;
  }

  public async logout(): Promise<void> {
    await this.client.post<null>('/auth/logout');
  }

  public async logoutAll(): Promise<void> {
    await this.client.post<null>('/auth/logout-all');
  }

  public async me(): Promise<AuthenticatedUser> {
    return this.client.get<AuthenticatedUser>('/auth/me');
  }

  /**
   * Switching role mints a new access token whose claims carry the new role and
   * business, so the caller must replace its stored session rather than assume
   * the existing token gained permissions.
   */
  public async switchRole(role: ActiveRole): Promise<SessionPayload> {
    return this.client.post<SessionPayload>('/auth/switch-role', { role });
  }
}
