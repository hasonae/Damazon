import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AdminProfile, Business, User, UserRoleAssignment } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { PasswordService } from '../../security/password.service.js';
import { TokenService, type AuthPrincipal } from '../../security/token.service.js';
import {
  AccountLockedError,
  AccountNotVerifiedError,
  AccountStatusError,
  ConflictError,
  DomainError,
  InvalidCredentialsError,
  RateLimitedError,
  ResourceNotFoundError,
  UnauthenticatedError,
} from '../../common/errors/domain.error.js';
import {
  ADMIN_DEPARTMENT_PERMISSIONS,
  ALL_USER_ROLES,
  ROLE_PERMISSIONS,
  USER_ROLES,
  isBusinessRole,
  type AdminDepartment,
  type UserRole,
} from '@damazon/shared-types';
import { APP_CONFIGURATION, type AppConfiguration } from '../../config/environment.js';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';
import {
  normalizeRegistrationPhone,
  type AuthenticatedUserResponse,
  type AuthSessionResponse,
  type AuthTokenPairResponse,
  type CompletePasswordRecoveryRequest,
  type EmailVerificationAcceptedResponse,
  type EmailVerificationPendingResponse,
  type LoginRequest,
  type PasswordRecoveryStartedResponse,
  type RegisterRequest,
  type StartPasswordRecoveryRequest,
  type VerifyEmailRequest,
} from './dto/auth.dto.js';
import { EMAIL_DELIVERY, type EmailDelivery } from './email-delivery.service.js';

type UserWithAccess = User & {
  roles: UserRoleAssignment[];
  adminProfile: AdminProfile | null;
  ownedBusinesses?: (Pick<Business, 'id' | 'type' | 'name' | 'verificationStatus' | 'status'> & {
    subscriptions?: { status: string; periodStart: Date; periodEnd: Date }[];
  })[];
};

const USABLE_STATUSES = new Set(['ACTIVE']);
const EMAIL_VERIFICATION_TTL_SECONDS = 15 * 60;
const EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS = 60;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
const ACTION_LINK_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(APP_CONFIGURATION) private readonly configuration: AppConfiguration,
    @Inject(EMAIL_DELIVERY) private readonly emailDelivery: EmailDelivery,
  ) {}

  public async register(payload: RegisterRequest): Promise<EmailVerificationPendingResponse> {
    this.assertEmailDeliveryConfigured();
    const phone = normalizeRegistrationPhone(payload.phone);
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('An account already exists for this phone number', [
        { field: 'phone', message: 'Phone number is already registered' },
      ]);
    }
    const emailTaken = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });
    if (emailTaken) {
      throw new ConflictError('An account already exists for this email address', [
        { field: 'email', message: 'Email address is already registered' },
      ]);
    }

    const passwordHash = await this.passwordService.hash(payload.password);

    const user = await this.prisma.$transaction(async (client) => {
      const created = await client.user.create({
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone,
          email: payload.email,
          passwordHash,
          locale: payload.locale,
          emailVerificationRequired: true,
        },
      });
      await client.userRoleAssignment.create({
        data: {
          userId: created.id,
          role: USER_ROLES.CUSTOMER,
          status: 'APPROVED',
        },
      });
      return client.user.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          roles: true,
          adminProfile: true,
          ownedBusinesses: {
            select: {
              id: true,
              type: true,
              name: true,
              verificationStatus: true,
              status: true,
              subscriptions: {
                where: { status: 'active' },
                select: { status: true, periodStart: true, periodEnd: true },
              },
            },
          },
        },
      });
    });

    await this.createEmailVerificationChallenge(user.id, payload.email, user.locale);
    this.logger.log(`Created account pending email verification ${user.id}`);
    return { email: payload.email, expiresInSeconds: EMAIL_VERIFICATION_TTL_SECONDS };
  }

  public async resendEmailVerification(email: string): Promise<EmailVerificationAcceptedResponse> {
    this.assertEmailDeliveryConfigured();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        locale: true,
        emailVerificationRequired: true,
      },
    });
    if (user === null || !user.emailVerificationRequired || user.email === null) {
      return { accepted: true };
    }

    const previous = await this.prisma.emailVerificationChallenge.findFirst({
      where: { userId: user.id, purpose: 'verify' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (previous !== null) {
      const elapsed = Math.floor((Date.now() - previous.createdAt.getTime()) / 1000);
      if (elapsed < EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS) {
        throw new RateLimitedError(EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS - elapsed);
      }
    }
    await this.createEmailVerificationChallenge(user.id, user.email, user.locale);
    return { accepted: true };
  }

  public async verifyEmail(
    payload: VerifyEmailRequest,
    metadata: { readonly ipAddress: string; readonly userAgent: string | undefined },
  ): Promise<AuthSessionResponse> {
    const now = new Date();
    const challenge = await this.prisma.emailVerificationChallenge.findFirst({
      where: {
        id: payload.challengeId,
        purpose: 'verify',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });
    if (
      challenge === null ||
      challenge.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS ||
      !challenge.user.emailVerificationRequired
    ) {
      throw new InvalidCredentialsError();
    }

    const submittedHash = Buffer.from(
      this.emailActionTokenHash('verify', challenge.userId, payload.token),
      'hex',
    );
    const storedHash = Buffer.from(challenge.codeHash, 'hex');
    const matches =
      submittedHash.length === storedHash.length && timingSafeEqual(submittedHash, storedHash);

    if (!matches) {
      await this.prisma.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          purpose: 'verify',
          attempts: challenge.attempts,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          attempts: { increment: 1 },
          ...(challenge.attempts + 1 >= EMAIL_VERIFICATION_MAX_ATTEMPTS ? { consumedAt: now } : {}),
        },
      });
      throw new InvalidCredentialsError();
    }

    const verifiedUser = await this.prisma.$transaction(async (client) => {
      const consumed = await client.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          purpose: 'verify',
          attempts: challenge.attempts,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new InvalidCredentialsError();
      }
      return client.user.update({
        where: { id: challenge.userId, emailVerificationRequired: true },
        data: { emailVerifiedAt: now, emailVerificationRequired: false },
        include: {
          roles: true,
          adminProfile: true,
          ownedBusinesses: {
            select: {
              id: true,
              type: true,
              name: true,
              verificationStatus: true,
              status: true,
              subscriptions: {
                where: { status: 'active' },
                select: { status: true, periodStart: true, periodEnd: true },
              },
            },
          },
        },
      });
    });

    const session = await this.createSession(verifiedUser, metadata);
    return {
      ...session.tokens,
      user: this.toAuthenticatedUser(verifiedUser, USER_ROLES.CUSTOMER, null),
    };
  }

  public async login(
    payload: LoginRequest,
    metadata: { readonly ipAddress: string; readonly userAgent: string | undefined },
  ): Promise<AuthSessionResponse> {
    const identifier = payload.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizeRegistrationPhone(identifier) },
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        roles: true,
        adminProfile: true,
        ownedBusinesses: {
          select: {
            id: true,
            type: true,
            name: true,
            verificationStatus: true,
            status: true,
            subscriptions: {
              where: { status: 'active' },
              select: { status: true, periodStart: true, periodEnd: true },
            },
          },
        },
      },
    });

    if (!user) {
      await this.passwordService.verify(payload.password, this.dummyHash());
      throw new InvalidCredentialsError();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedError(user.lockedUntil);
    }
    if (!USABLE_STATUSES.has(user.status)) {
      throw new AccountStatusError(user.status);
    }

    const passwordMatches = await this.passwordService.verify(payload.password, user.passwordHash);
    if (!passwordMatches) {
      await this.registerFailedAttempt(user);
      throw new InvalidCredentialsError();
    }
    if (user.emailVerificationRequired) {
      throw new AccountNotVerifiedError();
    }

    if (this.passwordService.needsRehash(user.passwordHash)) {
      const rehashed = await this.passwordService.hash(payload.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: rehashed },
      });
      this.logger.log(`Rehashed password for user ${user.id} with updated parameters`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await this.createSession(user, metadata);
    return {
      ...session.tokens,
      user: this.toAuthenticatedUser(user, USER_ROLES.CUSTOMER, null),
    };
  }

  public async startPasswordRecovery(
    payload: StartPasswordRecoveryRequest,
  ): Promise<PasswordRecoveryStartedResponse> {
    const challengeId = randomUUID();
    const identifier = payload.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizeRegistrationPhone(identifier) },
          { email: identifier },
          { username: identifier },
        ],
      },
      select: { id: true, email: true, locale: true, status: true },
    });
    if (user === null || user.email === null || !USABLE_STATUSES.has(user.status)) {
      return { accepted: true, challengeId };
    }

    const previous = await this.prisma.emailVerificationChallenge.findFirst({
      where: { userId: user.id, purpose: 'recover' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (
      previous !== null &&
      Date.now() - previous.createdAt.getTime() < EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS * 1000
    ) {
      return { accepted: true, challengeId: previous.id };
    }

    const challenge = await this.createActionChallenge(user.id, 'recover');
    await this.sendActionLink(user.email, user.locale, 'recover', challenge.id, challenge.token);
    return { accepted: true, challengeId: challenge.id };
  }

  public async completePasswordRecovery(
    payload: CompletePasswordRecoveryRequest,
  ): Promise<{ readonly accepted: true }> {
    const challenge = await this.prisma.emailVerificationChallenge.findFirst({
      where: {
        id: payload.challengeId,
        purpose: 'recover',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    const now = new Date();
    if (
      challenge === null ||
      challenge.attempts >= ACTION_LINK_MAX_ATTEMPTS ||
      challenge.user.email === null
    ) {
      throw new InvalidCredentialsError();
    }

    const submittedHash = Buffer.from(
      this.emailActionTokenHash('recover', challenge.userId, payload.token),
      'hex',
    );
    const storedHash = Buffer.from(challenge.codeHash, 'hex');
    if (submittedHash.length !== storedHash.length || !timingSafeEqual(submittedHash, storedHash)) {
      await this.prisma.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          attempts: challenge.attempts,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          attempts: { increment: 1 },
          ...(challenge.attempts + 1 >= ACTION_LINK_MAX_ATTEMPTS ? { consumedAt: now } : {}),
        },
      });
      throw new InvalidCredentialsError();
    }

    const passwordHash = await this.passwordService.hash(payload.newPassword);
    await this.prisma.$transaction(async (client) => {
      const consumed = await client.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          purpose: 'recover',
          consumedAt: null,
          attempts: challenge.attempts,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new InvalidCredentialsError();
      }
      await client.user.update({
        where: { id: challenge.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await client.userSession.updateMany({
        where: { userId: challenge.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_recovery' },
      });
    });
    return { accepted: true };
  }

  public async refresh(
    refreshToken: string,
    metadata: { readonly ipAddress: string; readonly userAgent: string | undefined },
  ): Promise<AuthTokenPairResponse> {
    const claims = this.tokenService.verifyRefreshToken(refreshToken);
    const tokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: true,
            adminProfile: true,
            ownedBusinesses: {
              select: {
                id: true,
                type: true,
                name: true,
                verificationStatus: true,
                status: true,
                subscriptions: {
                  where: { status: 'active' },
                  select: { status: true, periodStart: true, periodEnd: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.userId !== claims.sub || session.id !== claims.sid) {
      throw new UnauthenticatedError('Refresh session is no longer valid');
    }
    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId, 'refresh_token_reuse_detected');
      throw new UnauthenticatedError('Refresh session is no longer valid');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthenticatedError('Refresh session has expired');
    }
    if (!USABLE_STATUSES.has(session.user.status)) {
      throw new AccountStatusError(session.user.status);
    }

    const activeRole = claims.role ?? USER_ROLES.CUSTOMER;
    const roleAssignment = session.user.roles.find(
      (assignment) => assignment.role === activeRole && assignment.status === 'APPROVED',
    );
    if (!roleAssignment) {
      throw new UnauthenticatedError('The active role is no longer available');
    }

    let activeBusinessId: string | null = null;
    if (isBusinessRole(activeRole)) {
      const business = session.user.ownedBusinesses?.find(
        (item) => item.id === claims.bid && item.type === activeRole && item.status !== 'CLOSED',
      );
      if (!business) {
        throw new UnauthenticatedError('The active business is no longer available');
      }
      activeBusinessId = business.id;
    }

    const rotatedTokenId = randomTokenId();
    const nextToken = this.tokenService.issueRefreshToken(
      session.userId,
      session.id,
      rotatedTokenId,
      activeRole,
      activeBusinessId,
    );
    const rotated = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        tokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash: this.tokenService.hashOpaqueToken(nextToken.token),
        lastActivityAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent ?? session.userAgent,
      },
    });
    if (rotated.count !== 1) {
      await this.revokeAllSessions(session.userId, 'refresh_token_reuse_detected');
      throw new UnauthenticatedError('Refresh session is no longer valid');
    }

    const principal = this.buildPrincipal(
      session.user,
      session.id,
      activeRole,
      activeBusinessId,
      this.isBusinessOperational(session.user, activeRole, activeBusinessId),
    );
    const access = this.tokenService.issueAccessToken(principal);

    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: nextToken.token,
      refreshTokenExpiresIn: nextToken.expiresInSeconds,
      sessionId: session.id,
    };
  }

  public async logout(sessionId: string, userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'user_logout' },
    });
  }

  public async logoutEverywhere(userId: string): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'user_logout_all' },
    });
    return result.count;
  }

  public async resolvePrincipal(request: AuthenticatedRequest): Promise<AuthPrincipal | null> {
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const claims = this.tokenService.verifyAccessToken(header.slice('Bearer '.length));
    const session = await this.prisma.userSession.findUnique({
      where: { id: claims.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.userId !== claims.sub || session.revokedAt) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: {
        roles: true,
        adminProfile: true,
        ...(claims.bid === null
          ? {}
          : {
              ownedBusinesses: {
                where: { id: claims.bid },
                select: {
                  id: true,
                  type: true,
                  name: true,
                  status: true,
                  verificationStatus: true,
                  subscriptions: {
                    where: { status: 'active' },
                    select: { status: true, periodStart: true, periodEnd: true },
                  },
                },
              },
            }),
      },
    });
    if (!user || !USABLE_STATUSES.has(user.status)) {
      return null;
    }
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });
    return this.buildPrincipal(
      user,
      session.id,
      claims.role,
      claims.bid,
      this.isBusinessOperational(user, claims.role, claims.bid),
    );
  }

  public async switchRole(
    userId: string,
    requestedRole: UserRole,
    requestedBusinessId: string | undefined,
    currentSessionId: string,
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, adminProfile: true },
    });
    if (!user) {
      throw new ResourceNotFoundError('User', userId);
    }
    const assignment = user.roles.find((role) => role.role === requestedRole);
    if (!assignment) {
      throw new UnauthenticatedError('The requested role is not held by this account');
    }
    if (assignment.status !== 'APPROVED') {
      throw new AccountStatusError(`${requestedRole}:${assignment.status}`);
    }

    let businessId: string | null = null;
    let businessOperational = true;
    if (isBusinessRole(requestedRole)) {
      const now = new Date();
      const owned = await this.prisma.business.findFirst({
        where: { ownerId: userId, type: requestedRole, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          verificationStatus: true,
          subscriptions: {
            where: {
              status: 'active',
              periodStart: { lte: now },
              periodEnd: { gt: now },
            },
            select: { periodStart: true, periodEnd: true },
          },
        },
      });
      if (!owned) {
        throw new ResourceNotFoundError(`Active ${requestedRole} business`);
      }
      businessId =
        requestedBusinessId && requestedBusinessId === owned.id
          ? owned.id
          : (assignment.activeBusinessId ?? owned.id);
      businessOperational =
        businessId === owned.id &&
        owned.status === 'ACTIVE' &&
        owned.verificationStatus === 'APPROVED' &&
        owned.subscriptions.length > 0;
    }

    const principal = this.buildPrincipal(
      user,
      currentSessionId,
      requestedRole,
      businessId,
      businessOperational,
    );
    const access = this.tokenService.issueAccessToken(principal);
    const refresh = this.tokenService.issueRefreshToken(
      userId,
      currentSessionId,
      randomTokenId(),
      requestedRole,
      businessId,
    );
    await this.prisma.userSession.update({
      where: { id: currentSessionId },
      data: {
        tokenHash: this.tokenService.hashOpaqueToken(refresh.token),
        lastActivityAt: new Date(),
      },
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresIn: refresh.expiresInSeconds,
      sessionId: currentSessionId,
      user: this.toAuthenticatedUser(user, requestedRole, businessId),
    };
  }

  public async findById(
    userId: string,
    activeRole?: UserRole,
    activeBusinessId: string | null = null,
  ): Promise<AuthenticatedUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, adminProfile: true },
    });
    if (!user) {
      throw new ResourceNotFoundError('User', userId);
    }
    return this.toAuthenticatedUser(
      user,
      activeRole ?? this.resolveDefaultRole(user),
      activeBusinessId,
    );
  }

  private async createSession(
    user: UserWithAccess,
    metadata?: { readonly ipAddress: string; readonly userAgent: string | undefined },
  ): Promise<{ tokens: AuthTokenPairResponse; user: UserWithAccess }> {
    const sessionId = randomTokenId();
    const refreshToken = this.tokenService.issueRefreshToken(
      user.id,
      sessionId,
      randomTokenId(),
      USER_ROLES.CUSTOMER,
      null,
    );
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.tokenService.hashOpaqueToken(refreshToken.token),
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
        expiresAt: new Date(Date.now() + this.tokenService.refreshTtlSeconds * 1000),
      },
    });
    const principal = this.buildPrincipal(user, sessionId, USER_ROLES.CUSTOMER, null);
    const access = this.tokenService.issueAccessToken(principal);
    return {
      tokens: {
        accessToken: access.token,
        accessTokenExpiresIn: access.expiresInSeconds,
        refreshToken: refreshToken.token,
        refreshTokenExpiresIn: refreshToken.expiresInSeconds,
        sessionId,
      },
      user,
    };
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= this.configuration.auth.loginMaxFailedAttempts;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + this.configuration.auth.loginLockDurationSeconds * 1000)
          : user.lockedUntil,
      },
    });
    if (shouldLock) {
      this.logger.warn(`Locked account ${user.id} after ${attempts} failed login attempts`);
      await this.revokeAllSessions(user.id, 'account_locked');
    }
  }

  private async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private buildPrincipal(
    user: UserWithAccess,
    sessionId: string,
    activeRole: UserRole,
    activeBusinessId: string | null,
    businessOperational = true,
  ): AuthPrincipal {
    const roles = this.approvedRoles(user);
    const adminDepartments: readonly AdminDepartment[] =
      roles.includes(USER_ROLES.ADMIN) && user.adminProfile ? [user.adminProfile.department] : [];
    return {
      userId: user.id,
      sessionId,
      activeRole,
      activeBusinessId,
      roles,
      adminDepartments,
      businessOperational,
    };
  }

  private isBusinessOperational(
    user: UserWithAccess,
    activeRole: UserRole,
    activeBusinessId: string | null,
  ): boolean {
    if (!isBusinessRole(activeRole)) {
      return true;
    }
    const now = Date.now();
    const business = user.ownedBusinesses?.find(
      (item) => item.id === activeBusinessId && item.type === activeRole,
    );
    return (
      business?.status === 'ACTIVE' &&
      business.verificationStatus === 'APPROVED' &&
      business.subscriptions?.some(
        (subscription) =>
          subscription.status === 'active' &&
          subscription.periodStart.getTime() <= now &&
          subscription.periodEnd.getTime() > now,
      ) === true
    );
  }

  private resolveDefaultRole(user: UserWithAccess): UserRole {
    const approved = user.roles.find((assignment) => assignment.status === 'APPROVED');
    return approved?.role ?? USER_ROLES.CUSTOMER;
  }

  private dummyHash(): string {
    return `scrypt$${this.configuration.password.scryptCost}$${this.configuration.password.scryptBlockSize}$${this.configuration.password.scryptParallelization}${Buffer.from('0'.repeat(32), 'utf8').toString('base64')}$${Buffer.from('0'.repeat(64), 'utf8').toString('base64')}`;
  }

  private toAuthenticatedUser(
    user: UserWithAccess,
    activeRole: UserRole,
    activeBusinessId: string | null,
  ): AuthenticatedUserResponse {
    const roles = this.approvedRoles(user);
    const adminDepartments: readonly AdminDepartment[] =
      roles.includes(USER_ROLES.ADMIN) && user.adminProfile ? [user.adminProfile.department] : [];
    const grantedPermissions =
      activeRole === USER_ROLES.ADMIN
        ? adminDepartments.flatMap((department) => ADMIN_DEPARTMENT_PERMISSIONS[department] ?? [])
        : ROLE_PERMISSIONS[activeRole];
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      status: user.status,
      roles,
      activeRole,
      activeBusinessId,
      adminDepartments,
      permissions: [...new Set(grantedPermissions)],
      phoneVerified: user.phoneVerifiedAt !== null,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private assertEmailDeliveryConfigured(): void {
    if (!this.emailDelivery.isConfigured) {
      throw new DomainError(
        'SERVICE_UNAVAILABLE',
        'Email verification is unavailable until SMTP settings are configured',
      );
    }
  }

  private async createEmailVerificationChallenge(
    userId: string,
    email: string,
    locale: 'ar' | 'en',
  ): Promise<void> {
    const challenge = await this.createActionChallenge(userId, 'verify');
    await this.sendActionLink(email, locale, 'verify', challenge.id, challenge.token);
  }

  private async createActionChallenge(
    userId: string,
    purpose: 'verify' | 'recover',
  ): Promise<{ readonly id: string; readonly token: string }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const challenge = await this.prisma.$transaction(async (client) => {
      await client.emailVerificationChallenge.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      return client.emailVerificationChallenge.create({
        data: {
          userId,
          purpose,
          codeHash: this.emailActionTokenHash(purpose, userId, token),
          expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_SECONDS * 1000),
        },
        select: { id: true },
      });
    });
    return { id: challenge.id, token };
  }

  private async sendActionLink(
    email: string,
    locale: 'ar' | 'en',
    purpose: 'verify' | 'recover',
    challengeId: string,
    token: string,
  ): Promise<void> {
    const route = purpose === 'verify' ? 'verify-email' : 'reset-password';
    const link = new URL(route, this.configuration.http.customerAppOrigin);
    link.hash = new URLSearchParams({ challengeId, token }).toString();
    try {
      await this.emailDelivery.sendActionLink(
        email,
        link.toString(),
        locale,
        purpose,
        EMAIL_VERIFICATION_TTL_SECONDS / 60,
      );
    } catch {
      this.logger.error(`Failed to deliver ${purpose} email link`);
      throw new DomainError(
        'SERVICE_UNAVAILABLE',
        'Could not deliver the email link; retry after a short wait',
      );
    }
  }

  private emailActionTokenHash(
    purpose: 'verify' | 'recover',
    userId: string,
    token: string,
  ): string {
    return createHmac('sha256', this.configuration.auth.refreshSecret)
      .update(`damazon-email-action:v1:${purpose}:${userId}:${token}`)
      .digest('hex');
  }

  public availableRolesFor(roles: readonly UserRole[]): readonly UserRole[] {
    return ALL_USER_ROLES.filter((role) => roles.includes(role));
  }

  private approvedRoles(user: UserWithAccess): readonly UserRole[] {
    return user.roles
      .filter((assignment) => assignment.status === 'APPROVED')
      .map((assignment) => assignment.role);
  }
}

function randomTokenId(): string {
  return randomUUID();
}
