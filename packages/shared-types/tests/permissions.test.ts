import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ADMIN_DEPARTMENTS,
  ALL_USER_ROLES,
  PERMISSIONS,
  RESOURCES,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTORS,
  USER_ROLES,
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
  permissionsForRole,
  requiresVerification,
} from '../src/identity/index.js';
import type { Permission } from '../src/identity/permissions.js';

const ALL_DECLARED_PERMISSIONS = Object.values(PERMISSIONS) as readonly Permission[];

describe('authorization matrix', () => {
  it('declares every permission as resource:action with known values', () => {
    for (const permission of ALL_DECLARED_PERMISSIONS) {
      const [resource, action] = permission.split(':');
      expect(RESOURCES).toContain(resource);
      expect(ACTIONS).toContain(action);
    }
  });

  it('grants no duplicate permission strings inside a role', () => {
    for (const role of ALL_USER_ROLES) {
      const granted = permissionsForRole(role);
      expect(new Set(granted).size).toBe(granted.length);
    }
  });

  it('restricts destructive platform configuration to administrators', () => {
    expect(
      hasPermission(permissionsForRole(USER_ROLES.CUSTOMER), PERMISSIONS.SETTINGS_UPDATE),
    ).toBe(false);
    expect(hasPermission(permissionsForRole(USER_ROLES.MERCHANT), PERMISSIONS.USER_SUSPEND)).toBe(
      false,
    );
    expect(hasPermission(permissionsForRole(USER_ROLES.DRIVER), PERMISSIONS.ORDER_CANCEL)).toBe(
      false,
    );
  });

  it('keeps refund approval away from sellers and drivers', () => {
    expect(hasPermission(permissionsForRole(USER_ROLES.MERCHANT), PERMISSIONS.REFUND_APPROVE)).toBe(
      false,
    );
    expect(hasPermission(permissionsForRole(USER_ROLES.DRIVER), PERMISSIONS.REFUND_CREATE)).toBe(
      false,
    );
  });

  it('lets customers manage their own cart and orders but not the catalog', () => {
    const customer = permissionsForRole(USER_ROLES.CUSTOMER);
    expect(hasEveryPermission(customer, [PERMISSIONS.CART_MANAGE, PERMISSIONS.ORDER_CREATE])).toBe(
      true,
    );
    expect(hasPermission(customer, PERMISSIONS.STORE_CREATE)).toBe(true);
    expect(
      hasAnyPermission(customer, [PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_DELETE]),
    ).toBe(false);
  });

  it('lets sellers manage their catalog and inventory', () => {
    for (const role of [USER_ROLES.MERCHANT, USER_ROLES.RESTAURANT]) {
      const granted = permissionsForRole(role);
      expect(
        hasEveryPermission(granted, [PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.INVENTORY_UPDATE]),
      ).toBe(true);
    }
  });

  it('confines the platform administrator role to department-derived grants', () => {
    expect(ROLE_PERMISSIONS[USER_ROLES.ADMIN]).toHaveLength(0);
    expect(Object.values(ADMIN_DEPARTMENTS)).toContain('super_admin');
  });
});

describe('role descriptors', () => {
  it('requires verification for every business role but not for customers', () => {
    expect(requiresVerification(USER_ROLES.CUSTOMER)).toBe(false);
    expect(requiresVerification(USER_ROLES.MERCHANT)).toBe(true);
    expect(requiresVerification(USER_ROLES.RESTAURANT)).toBe(true);
    expect(requiresVerification(USER_ROLES.DELIVERY_COMPANY)).toBe(true);
    expect(requiresVerification(USER_ROLES.DRIVER)).toBe(true);
  });

  it('requires an explicit grant before the admin role becomes usable', () => {
    expect(ROLE_DESCRIPTORS[USER_ROLES.ADMIN].requiresAdminGrant).toBe(true);
    expect(ROLE_DESCRIPTORS[USER_ROLES.CUSTOMER].requiresAdminGrant).toBe(false);
  });
});
