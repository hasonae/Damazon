import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../src/config/environment.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import type { AuthService } from '../src/modules/auth/auth.service.js';
import type {
  AuthSessionResponse,
  AuthenticatedUserResponse,
} from '../src/modules/auth/dto/auth.dto.js';
import type { AuthenticatedRequest } from '../src/security/authenticated-request.js';
import type { AuthPrincipal } from '../src/security/token.service.js';

const user: AuthenticatedUserResponse = {
  id: 'user-id',
  firstName: 'Test',
  lastName: 'User',
  phone: '+963941000001',
  email: 'test@example.com',
  avatarUrl: null,
  locale: 'ar',
  status: 'ACTIVE',
  roles: ['customer', 'admin'],
  activeRole: 'customer',
  activeBusinessId: null,
  adminDepartments: ['super_admin'],
  permissions: [],
  phoneVerified: true,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const session: AuthSessionResponse = {
  accessToken: 'access-token',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-token',
  refreshTokenExpiresIn: 1209600,
  sessionId: 'session-id',
  user,
};

const configuration = {
  isProduction: false,
  http: { apiPrefix: 'api/v1' },
} as AppConfiguration;

describe('AuthController refresh-cookie contract', () => {
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutEverywhere: vi.fn(),
    findById: vi.fn(),
    switchRole: vi.fn(),
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
  };
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;
  const controller = new AuthController(authService as unknown as AuthService, configuration);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets an HttpOnly refresh cookie without returning it in the login payload', async () => {
    authService.login.mockResolvedValue(session);

    const result = await controller.login(
      { identifier: user.email ?? '', password: 'password' },
      { ip: '127.0.0.1' } as AuthenticatedRequest,
      response,
    );

    expect(result).toEqual({
      accessToken: session.accessToken,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
      sessionId: session.sessionId,
      user,
    });
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'damazon_refresh_token',
      session.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: session.refreshTokenExpiresIn * 1000,
      }),
    );
  });

  it('creates an account without opening a session before email verification', async () => {
    authService.register.mockResolvedValue({
      email: 'test@example.com',
      expiresInSeconds: 900,
    });

    const result = await controller.register({
      firstName: 'Test',
      lastName: 'User',
      phone: '0941000001',
      email: 'test@example.com',
      password: 'StrongPassword2026!',
      locale: 'ar',
    });

    expect(result).toEqual({ email: 'test@example.com', expiresInSeconds: 900 });
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('issues the session cookie only after verifying the email link', async () => {
    authService.verifyEmail.mockResolvedValue(session);

    const result = await controller.verifyEmail(
      { challengeId: 'challenge-id', token: 'opaque-link-token' },
      { ip: '127.0.0.1' } as AuthenticatedRequest,
      response,
    );

    expect(authService.verifyEmail).toHaveBeenCalledWith(
      { challengeId: 'challenge-id', token: 'opaque-link-token' },
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'damazon_refresh_token',
      session.refreshToken,
      expect.any(Object),
    );
  });

  it('does not disclose account existence in the resend response', async () => {
    authService.resendEmailVerification.mockResolvedValue({ accepted: true });

    await expect(
      controller.resendEmailVerification({ email: 'unknown@example.com' }),
    ).resolves.toEqual({ accepted: true });
  });

  it('rotates the refresh cookie and returns only the new access token', async () => {
    authService.refresh.mockResolvedValue({
      ...session,
      refreshToken: 'rotated-refresh-token',
    });

    const result = await controller.refresh(
      {
        cookies: { damazon_refresh_token: session.refreshToken },
        ip: '127.0.0.1',
      } as unknown as AuthenticatedRequest,
      response,
    );

    expect(authService.refresh).toHaveBeenCalledWith(
      session.refreshToken,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(result).toEqual({
      accessToken: session.accessToken,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
      sessionId: session.sessionId,
    });
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'damazon_refresh_token',
      'rotated-refresh-token',
      expect.any(Object),
    );
  });

  it('rejects a refresh request without a refresh cookie', async () => {
    await expect(
      controller.refresh({ cookies: {} } as AuthenticatedRequest, response),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('clears the refresh cookie after logout', async () => {
    authService.logout.mockResolvedValue(undefined);

    await controller.logout(
      { sessionId: session.sessionId, userId: user.id } as AuthPrincipal,
      response,
    );

    expect(response.clearCookie).toHaveBeenCalledWith(
      'damazon_refresh_token',
      expect.objectContaining({ path: '/api/v1/auth', sameSite: 'strict' }),
    );
  });

  it('rotates the refresh cookie when changing roles', async () => {
    authService.switchRole.mockResolvedValue({
      ...session,
      refreshToken: 'admin-refresh-token',
      user: { ...user, activeRole: 'admin' },
    });

    const result = await controller.switchRole(
      { sessionId: session.sessionId, userId: user.id } as AuthPrincipal,
      { role: 'admin' },
      response,
    );

    expect(result.user.activeRole).toBe('admin');
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith(
      'damazon_refresh_token',
      'admin-refresh-token',
      expect.any(Object),
    );
  });
});
