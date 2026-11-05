import { describe, expect, it, vi } from 'vitest';

import { PermissionDeniedError } from '../src/common/errors/domain.error.js';
import { PermissionsGuard } from '../src/common/guards/permissions.guard.js';
import { REQUIRED_PERMISSIONS_KEY } from '../src/common/decorators/permissions.decorator.js';
import type { AuthenticatedRequest } from '../src/security/authenticated-request.js';

function contextFor(
  principal: AuthenticatedRequest['auth'],
): Parameters<PermissionsGuard['canActivate']>[0] {
  const handler = vi.fn();
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => ({ auth: principal }) }),
  } as unknown as Parameters<PermissionsGuard['canActivate']>[0] & {
    requiredPermissions: readonly string[];
  };
}

describe('PermissionsGuard subscription suspension gate', () => {
  it('keeps owner status and order history readable while suspending business actions', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === REQUIRED_PERMISSIONS_KEY ? ['products:create'] : undefined,
      ),
    };
    const guard = new PermissionsGuard(reflector as never);
    const inactivePrincipal = {
      userId: 'owner-1',
      sessionId: 'session-1',
      activeRole: 'merchant',
      activeBusinessId: 'business-1',
      roles: ['merchant'],
      adminDepartments: [],
      businessOperational: false,
    } as const;

    expect(() => guard.canActivate(contextFor(inactivePrincipal))).toThrow(PermissionDeniedError);

    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === REQUIRED_PERMISSIONS_KEY ? ['stores:read'] : undefined,
    );
    expect(guard.canActivate(contextFor(inactivePrincipal))).toBe(true);
  });
});
