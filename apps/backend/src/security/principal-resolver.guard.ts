import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

/**
 * Resolves the authenticated principal from the bearer token before the
 * permission guard evaluates the route requirements.
 */
@Injectable()
export class PrincipalResolverGuard implements CanActivate {
  public constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.auth = (await this.authService.resolvePrincipal(request)) ?? undefined;
    return true;
  }
}
