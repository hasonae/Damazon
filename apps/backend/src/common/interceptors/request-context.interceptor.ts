import { randomUUID } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const incoming = request.header(REQUEST_ID_HEADER);
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64
        ? incoming
        : randomUUID();
    request.requestId = requestId;
    request.metadata = {
      requestId,
      ipAddress: request.ip ?? 'unknown',
      userAgent: request.header('user-agent'),
    };
    const response = context.switchToHttp().getResponse();
    response.setHeader(REQUEST_ID_HEADER, requestId);
    return next.handle();
  }
}
