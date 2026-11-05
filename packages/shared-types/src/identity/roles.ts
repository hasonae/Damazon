export const USER_ROLES = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  RESTAURANT: 'restaurant',
  DELIVERY_COMPANY: 'delivery_company',
  DRIVER: 'driver',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ALL_USER_ROLES = Object.values(USER_ROLES) as readonly UserRole[];

export const BUSINESS_ROLES = {
  MERCHANT: USER_ROLES.MERCHANT,
  RESTAURANT: USER_ROLES.RESTAURANT,
  DELIVERY_COMPANY: USER_ROLES.DELIVERY_COMPANY,
} as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[keyof typeof BUSINESS_ROLES];

export const ALL_BUSINESS_ROLES = Object.values(BUSINESS_ROLES) as readonly BusinessRole[];

export const ADMIN_DEPARTMENTS = {
  SUPER_ADMIN: 'super_admin',
  OPERATIONS: 'operations',
  FINANCE: 'finance',
  SUPPORT: 'support',
  MARKETING: 'marketing',
  CONTENT: 'content',
  MODERATION: 'moderation',
  SECURITY: 'security',
} as const;

export type AdminDepartment = (typeof ADMIN_DEPARTMENTS)[keyof typeof ADMIN_DEPARTMENTS];

export const ALL_ADMIN_DEPARTMENTS = Object.values(ADMIN_DEPARTMENTS) as readonly AdminDepartment[];

export interface RoleDescriptor {
  readonly role: UserRole;
  readonly requiresBusinessVerification: boolean;
  readonly requiresAdminGrant: boolean;
  readonly canSwitch: boolean;
}

export const ROLE_DESCRIPTORS = {
  [USER_ROLES.CUSTOMER]: {
    role: USER_ROLES.CUSTOMER,
    requiresBusinessVerification: false,
    requiresAdminGrant: false,
    canSwitch: true,
  },
  [USER_ROLES.MERCHANT]: {
    role: USER_ROLES.MERCHANT,
    requiresBusinessVerification: true,
    requiresAdminGrant: false,
    canSwitch: true,
  },
  [USER_ROLES.RESTAURANT]: {
    role: USER_ROLES.RESTAURANT,
    requiresBusinessVerification: true,
    requiresAdminGrant: false,
    canSwitch: true,
  },
  [USER_ROLES.DELIVERY_COMPANY]: {
    role: USER_ROLES.DELIVERY_COMPANY,
    requiresBusinessVerification: true,
    requiresAdminGrant: false,
    canSwitch: true,
  },
  [USER_ROLES.DRIVER]: {
    role: USER_ROLES.DRIVER,
    requiresBusinessVerification: true,
    requiresAdminGrant: false,
    canSwitch: true,
  },
  [USER_ROLES.ADMIN]: {
    role: USER_ROLES.ADMIN,
    requiresBusinessVerification: false,
    requiresAdminGrant: true,
    canSwitch: true,
  },
} as const satisfies Record<UserRole, RoleDescriptor>;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALL_USER_ROLES as readonly string[]).includes(value);
}

export function isBusinessRole(value: unknown): value is BusinessRole {
  return typeof value === 'string' && (ALL_BUSINESS_ROLES as readonly string[]).includes(value);
}

export function isAdminDepartment(value: unknown): value is AdminDepartment {
  return typeof value === 'string' && (ALL_ADMIN_DEPARTMENTS as readonly string[]).includes(value);
}

export function requiresVerification(value: UserRole): boolean {
  return ROLE_DESCRIPTORS[value].requiresBusinessVerification;
}

export function isActiveRoleAllowed(role: UserRole, heldRoles: readonly UserRole[]): boolean {
  return heldRoles.includes(role);
}
