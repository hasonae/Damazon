import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminDepartment, UserRole } from '@damazon/shared-types';
import { APP_CONFIGURATION, type AppConfiguration } from '../config/environment.js';
import { UnauthenticatedError } from '../common/errors/domain.error.js';

export const ACCESS_TOKEN_TYPE = 'access';
export const REFRESH_TOKEN_TYPE = 'refresh';

export interface AccessTokenClaims {
  readonly sub: string;
  readonly sid: string;
  readonly role: UserRole;
  readonly bid: string | null;
  readonly typ: typeof ACCESS_TOKEN_TYPE;
}

export interface RefreshTokenClaims {
  readonly sub: string;
  readonly sid: string;
  readonly jti: string;
  readonly role?: UserRole;
  readonly bid?: string | null;
  readonly typ: typeof REFRESH_TOKEN_TYPE;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

export interface AuthPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly activeRole: UserRole;
  readonly activeBusinessId: string | null;
  readonly roles: readonly UserRole[];
  readonly adminDepartments: readonly AdminDepartment[];
  readonly businessOperational?: boolean;
}

@Injectable()
export class TokenService {
  public constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(APP_CONFIGURATION) private readonly configuration: AppConfiguration,
  ) {}

  public issueAccessToken(principal: AuthPrincipal): IssuedAccessToken {
    const claims: AccessTokenClaims = {
      sub: principal.userId,
      sid: principal.sessionId,
      role: principal.activeRole,
      bid: principal.activeBusinessId,
      typ: ACCESS_TOKEN_TYPE,
    };
    const token = this.jwtService.sign(claims, {
      secret: this.configuration.auth.accessSecret,
      expiresIn: this.configuration.auth.accessTtlSeconds,
    });
    return { token, expiresInSeconds: this.configuration.auth.accessTtlSeconds };
  }

  public issueRefreshToken(
    userId: string,
    sessionId: string,
    tokenId: string,
    activeRole: UserRole,
    activeBusinessId: string | null,
  ): IssuedAccessToken {
    const claims: RefreshTokenClaims = {
      sub: userId,
      sid: sessionId,
      jti: tokenId,
      role: activeRole,
      bid: activeBusinessId,
      typ: REFRESH_TOKEN_TYPE,
    };
    const token = this.jwtService.sign(claims, {
      secret: this.configuration.auth.refreshSecret,
      expiresIn: this.configuration.auth.refreshTtlSeconds,
    });
    return { token, expiresInSeconds: this.configuration.auth.refreshTtlSeconds };
  }

  public verifyAccessToken(token: string): AccessTokenClaims {
    const claims = this.verify<AccessTokenClaims>(token, this.configuration.auth.accessSecret);
    if (claims.typ !== ACCESS_TOKEN_TYPE) {
      throw new UnauthenticatedError('Token type is not accepted on this endpoint');
    }
    return claims;
  }

  public verifyRefreshToken(token: string): RefreshTokenClaims {
    const claims = this.verify<RefreshTokenClaims>(token, this.configuration.auth.refreshSecret);
    if (claims.typ !== REFRESH_TOKEN_TYPE) {
      throw new UnauthenticatedError('Refresh token required');
    }
    return claims;
  }

  private verify<TClaims extends object>(token: string, secret: string): TClaims {
    try {
      return this.jwtService.verify<TClaims>(token, { secret });
    } catch {
      throw new UnauthenticatedError();
    }
  }

  public hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public get refreshTtlSeconds(): number {
    return this.configuration.auth.refreshTtlSeconds;
  }

  public get accessTtlSeconds(): number {
    return this.configuration.auth.accessTtlSeconds;
  }
}
