import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../src/config/environment.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import type { EmailDelivery } from '../src/modules/auth/email-delivery.service.js';
import type { PasswordService } from '../src/security/password.service.js';
import type { TokenService } from '../src/security/token.service.js';

const user = {
  id: 'user-id',
  firstName: 'Test',
  lastName: 'User',
  phone: '+963941000001',
  email: 'test@example.com',
  supabaseUserId: null,
  passwordHash: 'password-hash',
  avatarUrl: null,
  locale: 'ar' as const,
  status: 'ACTIVE',
  phoneVerifiedAt: null,
  emailVerifiedAt: null,
  emailVerificationRequired: true,
  lastLoginAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  roles: [],
  adminProfile: null,
  ownedBusinesses: [],
};

const tx = {
  user: {
    create: vi.fn().mockResolvedValue({ id: user.id }),
    update: vi.fn().mockResolvedValue(user),
    findUniqueOrThrow: vi.fn().mockResolvedValue(user),
  },
  userSession: {
    create: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  userRoleAssignment: { create: vi.fn().mockResolvedValue(undefined) },
  emailVerificationChallenge: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    create: vi.fn().mockResolvedValue({ id: 'challenge-id' }),
  },
};

const prismaMock = {
  user: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
  },
  userSession: {
    create: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  emailVerificationChallenge: {
    findFirst: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: vi.fn(async (operation: (client: never) => Promise<unknown>) =>
    operation(tx as never),
  ),
};

const passwordServiceMock = {
  hash: vi.fn().mockResolvedValue('password-hash'),
  verify: vi.fn().mockResolvedValue(false),
};
const emailDeliveryMock = {
  isConfigured: true,
  sendActionLink: vi.fn().mockResolvedValue(undefined),
};
const tokenServiceMock = {
  refreshTtlSeconds: 86_400,
  issueRefreshToken: vi.fn().mockReturnValue({
    token: 'refresh-token',
    expiresInSeconds: 86_400,
  }),
  hashOpaqueToken: vi.fn().mockReturnValue('refresh-token-hash'),
  issueAccessToken: vi.fn().mockReturnValue({ token: 'access-token', expiresInSeconds: 900 }),
};
const configuration = {
  auth: { refreshSecret: 'refresh-secret-for-action-link-hmac' },
  http: { customerAppOrigin: 'https://shop.example' },
  password: { scryptCost: 16, scryptBlockSize: 8, scryptParallelization: 1 },
} as AppConfiguration;

const service = new AuthService(
  prismaMock as unknown as PrismaService,
  passwordServiceMock as unknown as PasswordService,
  tokenServiceMock as unknown as TokenService,
  configuration,
  emailDeliveryMock as EmailDelivery,
);

function tokenHash(purpose: 'verify' | 'recover', userId: string, token: string): string {
  return createHmac('sha256', configuration.auth.refreshSecret)
    .update(`damazon-email-action:v1:${purpose}:${userId}:${token}`)
    .digest('hex');
}

describe('AuthService email-link authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailDeliveryMock.isConfigured = true;
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.emailVerificationChallenge.findFirst.mockReset();
    prismaMock.emailVerificationChallenge.updateMany.mockResolvedValue({ count: 1 });
    tx.emailVerificationChallenge.updateMany.mockResolvedValue({ count: 1 });
    tx.emailVerificationChallenge.create.mockResolvedValue({ id: 'challenge-id' });
    tx.user.create.mockResolvedValue({ id: user.id });
    tx.user.update.mockResolvedValue(user);
    tx.user.findUniqueOrThrow.mockResolvedValue(user);
    prismaMock.userSession.create.mockResolvedValue(undefined);
    tokenServiceMock.issueRefreshToken.mockReturnValue({
      token: 'refresh-token',
      expiresInSeconds: 86_400,
    });
    tokenServiceMock.hashOpaqueToken.mockReturnValue('refresh-token-hash');
    tokenServiceMock.issueAccessToken.mockReturnValue({
      token: 'access-token',
      expiresInSeconds: 900,
    });
  });

  it('stores only a token digest and sends a short-lived verification link', async () => {
    await expect(
      service.register({
        firstName: 'Test',
        lastName: 'User',
        phone: '0941000001',
        email: 'test@example.com',
        password: 'StrongPassword2026!',
        locale: 'ar',
      }),
    ).resolves.toEqual({ email: 'test@example.com', expiresInSeconds: 900 });

    const sentLink = emailDeliveryMock.sendActionLink.mock.calls[0]?.[1] as string;
    const storedChallenge = tx.emailVerificationChallenge.create.mock.calls[0]?.[0];
    const parsedLink = new URL(sentLink);
    const linkParams = new URLSearchParams(parsedLink.hash.slice(1));
    const token = linkParams.get('token') ?? '';
    expect(parsedLink.origin + parsedLink.pathname).toBe('https://shop.example/verify-email');
    expect(linkParams.get('challengeId')).toBe('challenge-id');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(storedChallenge?.data.purpose).toBe('verify');
    expect(storedChallenge?.data.codeHash).toBe(tokenHash('verify', user.id, token));
    expect(storedChallenge?.data.codeHash).not.toContain(token);
    expect(storedChallenge?.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(emailDeliveryMock.sendActionLink).toHaveBeenCalledWith(
      'test@example.com',
      sentLink,
      'ar',
      'verify',
      15,
    );
  });

  it('preserves a GitHub Pages project path in verification links', async () => {
    const pagesConfiguration = {
      ...configuration,
      http: {
        ...configuration.http,
        customerAppOrigin: 'https://hasonae.github.io/Damazon/',
      },
    } as AppConfiguration;
    const pagesService = new AuthService(
      prismaMock as unknown as PrismaService,
      passwordServiceMock as unknown as PasswordService,
      tokenServiceMock as unknown as TokenService,
      pagesConfiguration,
      emailDeliveryMock as EmailDelivery,
    );

    await pagesService.register({
      firstName: 'Test',
      lastName: 'User',
      phone: '0941000001',
      email: 'test@example.com',
      password: 'StrongPassword2026!',
      locale: 'ar',
    });

    const sentLink = emailDeliveryMock.sendActionLink.mock.calls[0]?.[1] as string;
    expect(new URL(sentLink).pathname).toBe('/Damazon/verify-email');
  });

  it('does not create an account when SMTP is unavailable', async () => {
    emailDeliveryMock.isConfigured = false;

    await expect(
      service.register({
        firstName: 'Test',
        lastName: 'User',
        phone: '0941000001',
        email: 'test@example.com',
        password: 'StrongPassword2026!',
        locale: 'ar',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('limits invalid email-link attempts without consuming the link immediately', async () => {
    prismaMock.emailVerificationChallenge.findFirst.mockResolvedValueOnce({
      id: 'challenge-id',
      userId: user.id,
      purpose: 'verify',
      codeHash: '0'.repeat(64),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { ...user, emailVerificationRequired: true },
    });

    await expect(
      service.verifyEmail(
        { challengeId: 'challenge-id', token: 'A'.repeat(43) },
        { ipAddress: '127.0.0.1', userAgent: undefined },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(prismaMock.emailVerificationChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'challenge-id',
          purpose: 'verify',
          attempts: 0,
          consumedAt: null,
        }),
        data: { attempts: { increment: 1 } },
      }),
    );
  });

  it('consumes a valid verification link and marks the email verified', async () => {
    const token = 'A'.repeat(43);
    const verifiedUser = { ...user, emailVerificationRequired: false };
    prismaMock.emailVerificationChallenge.findFirst.mockResolvedValueOnce({
      id: 'challenge-id',
      userId: user.id,
      purpose: 'verify',
      codeHash: tokenHash('verify', user.id, token),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user,
    });
    tx.user.update.mockResolvedValueOnce(verifiedUser);

    await expect(
      service.verifyEmail(
        { challengeId: 'challenge-id', token },
        { ipAddress: '127.0.0.1', userAgent: undefined },
      ),
    ).resolves.toMatchObject({
      user: { id: user.id },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(tx.emailVerificationChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'challenge-id', purpose: 'verify' }),
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id, emailVerificationRequired: true },
        data: expect.objectContaining({ emailVerificationRequired: false }),
      }),
    );
  });

  it('sends an opaque recovery link only for eligible accounts and throttles repeats', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      locale: user.locale,
      status: user.status,
    });
    prismaMock.emailVerificationChallenge.findFirst.mockResolvedValueOnce(null);

    const started = await service.startPasswordRecovery({ identifier: user.email });
    const link = new URL(emailDeliveryMock.sendActionLink.mock.calls[0]?.[1] as string);
    const linkParams = new URLSearchParams(link.hash.slice(1));
    const token = linkParams.get('token') ?? '';
    const storedChallenge = tx.emailVerificationChallenge.create.mock.calls[0]?.[0];
    expect(started).toEqual({ accepted: true, challengeId: 'challenge-id' });
    expect(link.pathname).toBe('/reset-password');
    expect(storedChallenge?.data.purpose).toBe('recover');
    expect(storedChallenge?.data.codeHash).toBe(tokenHash('recover', user.id, token));

    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: user.id,
      email: user.email,
      locale: user.locale,
      status: user.status,
    });
    prismaMock.emailVerificationChallenge.findFirst.mockResolvedValueOnce({
      id: 'challenge-id',
      createdAt: new Date(),
    });
    await service.startPasswordRecovery({ identifier: user.email });
    expect(emailDeliveryMock.sendActionLink).toHaveBeenCalledTimes(1);
  });

  it('does not disclose account existence in the recovery response', async () => {
    await expect(
      service.startPasswordRecovery({ identifier: 'unknown@example.com' }),
    ).resolves.toEqual({ accepted: true, challengeId: expect.any(String) });
    expect(emailDeliveryMock.sendActionLink).not.toHaveBeenCalled();
  });

  it('resets the password once with a valid recovery link and revokes sessions', async () => {
    const token = 'B'.repeat(43);
    prismaMock.emailVerificationChallenge.findFirst.mockResolvedValueOnce({
      id: 'recovery-id',
      userId: user.id,
      purpose: 'recover',
      codeHash: tokenHash('recover', user.id, token),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { ...user, emailVerificationRequired: false },
    });

    await expect(
      service.completePasswordRecovery({
        challengeId: 'recovery-id',
        token,
        newPassword: 'NewStrongPassword2026!',
      }),
    ).resolves.toEqual({ accepted: true });

    expect(tx.emailVerificationChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'recovery-id', purpose: 'recover' }),
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({
          passwordHash: 'password-hash',
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id, revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'password_recovery' }),
      }),
    );
  });

  it('uses the local password hash for login and has no phone second factor', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({
      ...user,
      emailVerificationRequired: false,
    });
    passwordServiceMock.verify.mockResolvedValueOnce(false);

    await expect(
      service.login(
        { identifier: user.email, password: 'invalid-password' },
        { ipAddress: '127.0.0.1', userAgent: undefined },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(passwordServiceMock.verify).toHaveBeenCalledWith('invalid-password', user.passwordHash);
  });
});
