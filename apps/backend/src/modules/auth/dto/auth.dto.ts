import { z } from 'zod';
import { isValidSyrianMobile, parseSyrianPhone } from '@damazon/utilities';
import { USER_ROLES, type UserRole } from '@damazon/shared-types';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../../security/password.service.js';

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().refine(isValidSyrianMobile, 'A valid Syrian mobile number is required'),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export type RegisterRequest = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z
  .object({
    challengeId: z.string().uuid(),
    token: z.string().min(40).max(100),
  })
  .strict();

export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;

export const resendEmailVerificationSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();

export type ResendEmailVerificationRequest = z.infer<typeof resendEmailVerificationSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  deviceLabel: z.string().trim().max(120).optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export const startPasswordRecoverySchema = z
  .object({ identifier: z.string().trim().min(3).max(254) })
  .strict();

export type StartPasswordRecoveryRequest = z.infer<typeof startPasswordRecoverySchema>;

export const completePasswordRecoverySchema = z
  .object({
    challengeId: z.string().uuid(),
    token: z.string().min(40).max(100),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export type CompletePasswordRecoveryRequest = z.infer<typeof completePasswordRecoverySchema>;

export const switchRoleSchema = z.object({
  role: z.nativeEnum(USER_ROLES),
  businessId: z.string().uuid().optional(),
});

export type SwitchRoleRequest = z.infer<typeof switchRoleSchema>;

export interface EmailVerificationPendingResponse {
  readonly email: string;
  readonly expiresInSeconds: number;
}

export interface EmailVerificationAcceptedResponse {
  readonly accepted: true;
}

export interface PasswordRecoveryStartedResponse {
  readonly accepted: true;
  readonly challengeId: string;
}

export interface AuthenticatedUserResponse {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly locale: 'ar' | 'en';
  readonly status: string;
  readonly roles: readonly UserRole[];
  readonly activeRole: UserRole;
  readonly activeBusinessId: string | null;
  readonly adminDepartments: readonly string[];
  readonly permissions: readonly string[];
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
  readonly createdAt: string;
}

export interface AuthTokenPairResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresIn: number;
  readonly sessionId: string;
}

export interface AuthSessionResponse extends AuthTokenPairResponse {
  readonly user: AuthenticatedUserResponse;
}

export interface AuthAccessTokenResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly sessionId: string;
}

export interface AuthClientSessionResponse extends AuthAccessTokenResponse {
  readonly user: AuthenticatedUserResponse;
}

export type AuthClientLoginResponse = AuthClientSessionResponse;

export function normalizeRegistrationPhone(phone: string): string {
  return parseSyrianPhone(phone)?.e164 ?? phone.replace(/\s+/g, '');
}
