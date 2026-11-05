import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { UnauthenticatedError } from '../errors/domain.error.js';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthenticatedError();
    }
    return true;
  }
}
