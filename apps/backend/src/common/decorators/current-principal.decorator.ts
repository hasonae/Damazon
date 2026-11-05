import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '../../security/token.service.js';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new Error('CurrentPrincipal used on an unauthenticated route');
    }
    return request.auth;
  },
);

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new Error('CurrentUserId used on an unauthenticated route');
    }
    return request.auth.userId;
  },
);
