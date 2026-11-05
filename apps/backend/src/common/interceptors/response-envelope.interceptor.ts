import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import type { ApiResponse, ApiResponseMeta, PaginatedResult } from '@damazon/shared-types';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

function isPaginated(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items) &&
    typeof (value as { meta?: unknown }).meta === 'object'
  );
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const meta: ApiResponseMeta = {
      requestId: request.requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };
    return next.handle().pipe(
      map((data: unknown): ApiResponse<unknown> => {
        if (isPaginated(data)) {
          return {
            success: true,
            body: { data: data.items, meta: { ...meta, ...data.meta } },
            meta,
          };
        }
        return { success: true, body: { data }, meta };
      }),
    );
  }
}
