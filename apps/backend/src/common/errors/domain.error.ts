import {
  API_ERROR_CODES,
  httpStatusForErrorCode,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiFieldViolation,
} from '@damazon/shared-types';

export class DomainError extends Error {
  public readonly code: ApiErrorCode;

  public readonly status: number;

  public readonly details: readonly ApiFieldViolation[] | undefined;

  public constructor(code: ApiErrorCode, message: string, details?: readonly ApiFieldViolation[]) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = httpStatusForErrorCode(code);
    this.details = details;
  }

  public toBody(traceId: string | undefined): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && this.details.length > 0 ? { details: this.details } : {}),
      ...(traceId ? { traceId } : {}),
    };
  }
}

export class ValidationFailedError extends DomainError {
  public constructor(details: readonly ApiFieldViolation[]) {
    super(API_ERROR_CODES.VALIDATION_FAILED, 'Request validation failed', details);
    this.name = 'ValidationFailedError';
  }
}

export class UnauthenticatedError extends DomainError {
  public constructor(message = 'Authentication is required') {
    super(API_ERROR_CODES.UNAUTHENTICATED, message);
    this.name = 'UnauthenticatedError';
  }
}

export class InvalidCredentialsError extends DomainError {
  public constructor() {
    super(API_ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends DomainError {
  public constructor(unlockAt: Date) {
    super(API_ERROR_CODES.ACCOUNT_LOCKED, `Account is locked until ${unlockAt.toISOString()}`);
    this.name = 'AccountLockedError';
  }
}

export class AccountStatusError extends DomainError {
  public constructor(status: string) {
    super(API_ERROR_CODES.ACCOUNT_LOCKED, `Account is not usable in status: ${status}`);
    this.name = 'AccountStatusError';
  }
}

export class AccountNotVerifiedError extends DomainError {
  public constructor(message = 'Verify your email address before signing in') {
    super(API_ERROR_CODES.ACCOUNT_NOT_VERIFIED, message);
    this.name = 'AccountNotVerifiedError';
  }
}

export class PermissionDeniedError extends DomainError {
  public constructor(required: readonly string[]) {
    super(API_ERROR_CODES.PERMISSION_DENIED, `Missing required permission: ${required.join(', ')}`);
    this.name = 'PermissionDeniedError';
  }
}

export class ResourceNotFoundError extends DomainError {
  public constructor(resource: string, identifier?: string) {
    super(
      API_ERROR_CODES.RESOURCE_NOT_FOUND,
      identifier ? `${resource} ${identifier} was not found` : `${resource} was not found`,
    );
    this.name = 'ResourceNotFoundError';
  }
}

export class ConflictError extends DomainError {
  public constructor(message: string, details?: readonly ApiFieldViolation[]) {
    super(API_ERROR_CODES.CONFLICT, message, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleViolationError extends DomainError {
  public constructor(message: string) {
    super(API_ERROR_CODES.BUSINESS_RULE_VIOLATION, message);
    this.name = 'BusinessRuleViolationError';
  }
}

export class IllegalStateTransitionError extends DomainError {
  public constructor(entity: string, from: string, to: string) {
    super(
      API_ERROR_CODES.ILLEGAL_STATE_TRANSITION,
      `Illegal ${entity} transition: ${from} -> ${to}`,
    );
    this.name = 'IllegalStateTransitionError';
  }
}

export class OutOfStockError extends DomainError {
  public constructor(productName: string, requested: number, available: number) {
    super(
      API_ERROR_CODES.OUT_OF_STOCK,
      `Insufficient stock for ${productName}: requested ${requested}, available ${available}`,
      [{ field: 'quantity', message: `Only ${available} left in stock`, code: 'out_of_stock' }],
    );
    this.name = 'OutOfStockError';
  }
}

export class RateLimitedError extends DomainError {
  public constructor(retryAfterSeconds: number) {
    super(
      API_ERROR_CODES.RATE_LIMITED,
      `Too many requests, retry after ${retryAfterSeconds} seconds`,
    );
    this.name = 'RateLimitedError';
  }
}

export class InternalError extends DomainError {
  public constructor(message = 'An unexpected error occurred') {
    super(API_ERROR_CODES.INTERNAL_ERROR, message);
    this.name = 'InternalError';
  }
}
