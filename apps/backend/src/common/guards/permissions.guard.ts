import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { PermissionDeniedError } from '../errors/domain.error.js';
import {
  ADMIN_DEPARTMENT_PERMISSIONS,
  isBusinessRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type AdminDepartment,
  type Permission,
  type UserRole,
} from '@damazon/shared-types';
import type { AuthenticatedRequest } from '../../security/authenticated-request.js';

function resolveGrantedPermissions(
  activeRole: UserRole,
  adminDepartments: readonly AdminDepartment[],
): readonly Permission[] {
  if (activeRole !== 'admin') {
    return ROLE_PERMISSIONS[activeRole];
  }
  if (adminDepartments.length === 0) {
    return [];
  }
  const granted = new Set<Permission>();
  for (const department of adminDepartments) {
    for (const permission of ADMIN_DEPARTMENT_PERMISSIONS[department]) {
      granted.add(permission);
    }
  }
  return [...granted];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<readonly Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<readonly Permission[]>(
      `${REQUIRED_PERMISSIONS_KEY}:any`,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredAll && !requiredAny) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.auth;
    if (!principal) {
      throw new PermissionDeniedError(requiredAll ?? requiredAny ?? []);
    }
    if (principal.businessOperational === false && isBusinessRole(principal.activeRole)) {
      const allowedWhileInactive = new Set<Permission>([
        PERMISSIONS.STORE_READ,
        PERMISSIONS.STORE_UPDATE,
        PERMISSIONS.ORDER_READ,
      ]);
      const requested = [...(requiredAll ?? []), ...(requiredAny ?? [])];
      const hasForbiddenRequired = requiredAll?.some(
        (permission) => !allowedWhileInactive.has(permission),
      );
      const hasAllowedAlternative =
        requiredAny === undefined ||
        requiredAny.some((permission) => allowedWhileInactive.has(permission));
      if (hasForbiddenRequired || !hasAllowedAlternative) {
        throw new PermissionDeniedError(requested);
      }
    }
    const granted = resolveGrantedPermissions(principal.activeRole, principal.adminDepartments);
    if (requiredAll) {
      const missing = requiredAll.filter((permission) => !granted.includes(permission));
      if (missing.length > 0) {
        throw new PermissionDeniedError(missing);
      }
    }
    if (requiredAny) {
      const satisfied = requiredAny.some((permission) => granted.includes(permission));
      if (!satisfied) {
        throw new PermissionDeniedError(requiredAny);
      }
    }
    return true;
  }
}
