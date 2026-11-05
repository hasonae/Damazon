import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  completePasswordRecoverySchema,
  registerSchema,
  resendEmailVerificationSchema,
  startPasswordRecoverySchema,
  switchRoleSchema,
  verifyEmailSchema,
  type AuthClientSessionResponse,
  type CompletePasswordRecoveryRequest,
  type LoginRequest,
  type PasswordRecoveryStartedResponse,
  type RegisterRequest,
  type ResendEmailVerificationRequest,
  type SwitchRoleRequest,
  type StartPasswordRecoveryRequest,
  type VerifyEmailRequest,
  type EmailVerificationAcceptedResponse,
  type EmailVerificationPendingResponse,
} from './dto/auth.dto.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';
import { UnauthenticatedError } from '../../common/errors/domain.error.js';
import { APP_CONFIGURATION, type AppConfiguration } from '../../config/environment.js';
import type {
  AuthAccessTokenResponse,
  AuthSessionResponse,
  AuthTokenPairResponse,
  AuthenticatedUserResponse,
} from './dto/auth.dto.js';

const REFRESH_COOKIE = 'damazon_refresh_token';

@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(APP_CONFIGURATION) private readonly configuration: AppConfiguration,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  public register(
    @Body(new ZodValidationPipe(registerSchema, { target: 'body' })) payload: RegisterRequest,
  ): Promise<EmailVerificationPendingResponse> {
    return this.authService.register(payload);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  public verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema, { target: 'body' }))
    payload: VerifyEmailRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthClientSessionResponse> {
    return this.authService
      .verifyEmail(payload, {
        ipAddress: request.metadata?.ipAddress ?? request.ip ?? 'unknown',
        userAgent: request.metadata?.userAgent,
      })
      .then((session) => {
        this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresIn);
        return this.toClientSession(session);
      });
  }

  @Public()
  @Post('resend-email-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  public resendEmailVerification(
    @Body(new ZodValidationPipe(resendEmailVerificationSchema, { target: 'body' }))
    payload: ResendEmailVerificationRequest,
  ): Promise<EmailVerificationAcceptedResponse> {
    return this.authService.resendEmailVerification(payload.email);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  public login(
    @Body(new ZodValidationPipe(loginSchema, { target: 'body' })) payload: LoginRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthClientSessionResponse> {
    return this.authService
      .login(payload, {
        ipAddress: request.metadata?.ipAddress ?? request.ip ?? 'unknown',
        userAgent: request.metadata?.userAgent,
      })
      .then((session) => {
        this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresIn);
        return this.toClientSession(session);
      });
  }

  @Public()
  @Post('password-recovery/start')
  @HttpCode(HttpStatus.ACCEPTED)
  public startPasswordRecovery(
    @Body(new ZodValidationPipe(startPasswordRecoverySchema, { target: 'body' }))
    payload: StartPasswordRecoveryRequest,
  ): Promise<PasswordRecoveryStartedResponse> {
    return this.authService.startPasswordRecovery(payload);
  }

  @Public()
  @Post('password-recovery/complete')
  @HttpCode(HttpStatus.OK)
  public completePasswordRecovery(
    @Body(new ZodValidationPipe(completePasswordRecoverySchema, { target: 'body' }))
    payload: CompletePasswordRecoveryRequest,
  ): Promise<{ readonly accepted: true }> {
    return this.authService.completePasswordRecovery(payload);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthAccessTokenResponse> {
    const refreshToken: unknown = request.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new UnauthenticatedError('Refresh session is no longer valid');
    }
    let session: AuthTokenPairResponse;
    try {
      session = await this.authService.refresh(refreshToken, {
        ipAddress: request.metadata?.ipAddress ?? request.ip ?? 'unknown',
        userAgent: request.metadata?.userAgent,
      });
    } catch (cause) {
      this.clearRefreshCookie(response);
      throw cause;
    }
    this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresIn);
    return this.toClientTokens(session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(principal.sessionId, principal.userId);
    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  public logoutEverywhere(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ readonly revokedSessions: number }> {
    return this.authService.logoutEverywhere(principal.userId).then((revokedSessions) => {
      this.clearRefreshCookie(response);
      return { revokedSessions };
    });
  }

  @Get('me')
  public me(@CurrentPrincipal() principal: AuthPrincipal): Promise<AuthenticatedUserResponse> {
    return this.authService.findById(
      principal.userId,
      principal.activeRole,
      principal.activeBusinessId,
    );
  }

  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  public switchRole(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(switchRoleSchema, { target: 'body' })) payload: SwitchRoleRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthClientSessionResponse> {
    return this.authService
      .switchRole(principal.userId, payload.role, payload.businessId, principal.sessionId)
      .then((session) => {
        this.setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresIn);
        return this.toClientSession(session);
      });
  }

  private toClientTokens(tokens: AuthTokenPairResponse): AuthAccessTokenResponse {
    return {
      accessToken: tokens.accessToken,
      accessTokenExpiresIn: tokens.accessTokenExpiresIn,
      sessionId: tokens.sessionId,
    };
  }

  private toClientSession(session: AuthSessionResponse): AuthClientSessionResponse {
    return { ...this.toClientTokens(session), user: session.user };
  }

  private setRefreshCookie(response: Response, token: string, expiresInSeconds: number): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.configuration.isProduction,
      sameSite: 'strict',
      path: `/${this.configuration.http.apiPrefix}/auth`,
      maxAge: expiresInSeconds * 1000,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.configuration.isProduction,
      sameSite: 'strict',
      path: `/${this.configuration.http.apiPrefix}/auth`,
    });
  }
}
