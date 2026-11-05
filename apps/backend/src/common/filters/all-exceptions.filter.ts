import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  API_ERROR_CODES,
  type ApiErrorBody,
  type ApiFieldViolation,
  type ApiResponseMeta,
} from '@damazon/shared-types';
import { DomainError } from '../errors/domain.error.js';
import { toFieldViolations } from '../pipes/zod-validation.pipe.js';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

const PRISMA_TARGET_NOT_FOUND = 'P2025';
const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(
        `Non HTTP exception escaped to the global filter: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      return;
    }
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse();
    const traceId = request.requestId;
    const meta: ApiResponseMeta = {
      requestId: traceId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };

    const { status, body } = this.resolve(exception, traceId);

    const logPayload = {
      requestId: traceId,
      method: request.method,
      path: request.originalUrl,
      status,
      userId: request.auth?.userId,
      code: body.code,
    };

    if (status >= 500) {
      this.logger.error(
        `${logPayload.method} ${logPayload.path} failed with ${status} (${body.code})`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${logPayload.method} ${logPayload.path} rejected with ${status} (${body.code})`,
      );
    }

    response.status(status).json({ success: false, error: body, meta });
  }

  private resolve(
    exception: unknown,
    traceId: string | undefined,
  ): { status: number; body: ApiErrorBody } {
    if (exception instanceof DomainError) {
      return { status: exception.status, body: exception.toBody(traceId) };
    }
    if (exception instanceof ZodError) {
      return this.fromFieldViolations(toFieldViolations(exception));
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return this.fromHttpException(status, payload);
    }
    return {
      status: 500,
      body: this.body(API_ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred', traceId),
    };
  }

  private fromFieldViolations(details: ApiFieldViolation[]): {
    status: number;
    body: ApiErrorBody;
  } {
    return {
      status: 400,
      body: this.body(
        API_ERROR_CODES.VALIDATION_FAILED,
        'Request validation failed',
        undefined,
        details,
      ),
    };
  }

  private fromPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ApiErrorBody;
  } {
    if (error.code === PRISMA_TARGET_NOT_FOUND) {
      return {
        status: 404,
        body: this.body(API_ERROR_CODES.RESOURCE_NOT_FOUND, 'Resource was not found', undefined),
      };
    }
    if (error.code === PRISMA_UNIQUE_VIOLATION) {
      const target = Array.isArray(error.meta?.['target'])
        ? (error.meta?.['target'] as unknown[]).join(', ')
        : undefined;
      return {
        status: 409,
        body: this.body(
          API_ERROR_CODES.CONFLICT,
          target ? `A record with the same ${target} already exists` : 'Duplicate record',
          undefined,
        ),
      };
    }
    return {
      status: 500,
      body: this.body(API_ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred', undefined),
    };
  }

  private fromHttpException(
    status: number,
    payload: string | object,
  ): { status: number; body: ApiErrorBody } {
    const message =
      typeof payload === 'string' ? payload : this.extractMessage(payload, 'Request rejected');
    const details = this.extractDetails(payload);
    const code = this.codeForStatus(status);
    return { status, body: this.body(code, message, undefined, details) };
  }

  private extractMessage(payload: string | object, fallback: string): string {
    if (typeof payload !== 'object' || payload === null) {
      return fallback;
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((entry): entry is string => typeof entry === 'string').join('; ');
    }
    return fallback;
  }

  private extractDetails(payload: string | object): ApiFieldViolation[] | undefined {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => ({ field: 'request', message: entry }));
    }
    return undefined;
  }

  private codeForStatus(status: number): ApiErrorBody['code'] {
    switch (status) {
      case 400:
        return API_ERROR_CODES.VALIDATION_FAILED;
      case 401:
        return API_ERROR_CODES.UNAUTHENTICATED;
      case 403:
        return API_ERROR_CODES.PERMISSION_DENIED;
      case 404:
        return API_ERROR_CODES.RESOURCE_NOT_FOUND;
      case 409:
        return API_ERROR_CODES.CONFLICT;
      case 413:
        return API_ERROR_CODES.PAYLOAD_TOO_LARGE;
      case 415:
        return API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE;
      case 429:
        return API_ERROR_CODES.RATE_LIMITED;
      case 503:
        return API_ERROR_CODES.SERVICE_UNAVAILABLE;
      default:
        return status >= 500
          ? API_ERROR_CODES.INTERNAL_ERROR
          : API_ERROR_CODES.BUSINESS_RULE_VIOLATION;
    }
  }

  private body(
    code: ApiErrorBody['code'],
    message: string,
    traceId: string | undefined,
    details?: ApiFieldViolation[],
  ): ApiErrorBody {
    return {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
      ...(traceId ? { traceId } : {}),
    };
  }

  private describe(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
  }
}
