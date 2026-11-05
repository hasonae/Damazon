import type { AdminDepartment, BusinessRole, UserRole } from './roles.js';

export const RESOURCES = [
  'users',
  'businesses',
  'stores',
  'restaurants',
  'products',
  'categories',
  'inventory',
  'carts',
  'favorites',
  'orders',
  'payments',
  'refunds',
  'subscriptions',
  'invoices',
  'delivery',
  'drivers',
  'assignments',
  'zones',
  'reviews',
  'coupons',
  'advertisements',
  'notifications',
  'messages',
  'media',
  'analytics',
  'reports',
  'support',
  'disputes',
  'audit',
  'settings',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'cancel',
  'approve',
  'suspend',
  'export',
  'manage',
] as const;

export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}:${Action}`;

export const PERMISSIONS = {
  USER_READ: 'users:read',
  USER_UPDATE: 'users:update',
  USER_SUSPEND: 'users:suspend',
  USER_EXPORT: 'users:export',

  BUSINESS_READ: 'businesses:read',
  BUSINESS_UPDATE: 'businesses:update',
  BUSINESS_APPROVE: 'businesses:approve',
  BUSINESS_SUSPEND: 'businesses:suspend',

  STORE_READ: 'stores:read',
  STORE_CREATE: 'stores:create',
  STORE_UPDATE: 'stores:update',
  STORE_MANAGE: 'stores:manage',

  RESTAURANT_READ: 'restaurants:read',
  RESTAURANT_CREATE: 'restaurants:create',
  RESTAURANT_UPDATE: 'restaurants:update',
  RESTAURANT_MANAGE: 'restaurants:manage',

  PRODUCT_READ: 'products:read',
  PRODUCT_CREATE: 'products:create',
  PRODUCT_UPDATE: 'products:update',
  PRODUCT_DELETE: 'products:delete',

  CATEGORY_READ: 'categories:read',
  CATEGORY_MANAGE: 'categories:manage',

  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',

  CART_READ: 'carts:read',
  CART_MANAGE: 'carts:manage',

  FAVORITE_READ: 'favorites:read',
  FAVORITE_MANAGE: 'favorites:manage',

  ORDER_READ: 'orders:read',
  ORDER_CREATE: 'orders:create',
  ORDER_UPDATE: 'orders:update',
  ORDER_CANCEL: 'orders:cancel',
  ORDER_EXPORT: 'orders:export',

  PAYMENT_READ: 'payments:read',
  PAYMENT_CREATE: 'payments:create',
  PAYMENT_MANAGE: 'payments:manage',

  REFUND_CREATE: 'refunds:create',
  REFUND_APPROVE: 'refunds:approve',

  SUBSCRIPTION_READ: 'subscriptions:read',
  SUBSCRIPTION_MANAGE: 'subscriptions:manage',

  INVOICE_READ: 'invoices:read',
  INVOICE_MANAGE: 'invoices:manage',

  DELIVERY_READ: 'delivery:read',
  DELIVERY_UPDATE: 'delivery:update',
  DELIVERY_MANAGE: 'delivery:manage',

  DRIVER_READ: 'drivers:read',
  DRIVER_CREATE: 'drivers:create',
  DRIVER_UPDATE: 'drivers:update',
  DRIVER_SUSPEND: 'drivers:suspend',

  ASSIGNMENT_READ: 'assignments:read',
  ASSIGNMENT_CREATE: 'assignments:create',
  ASSIGNMENT_UPDATE: 'assignments:update',

  ZONE_READ: 'zones:read',
  ZONE_CREATE: 'zones:create',
  ZONE_UPDATE: 'zones:update',
  ZONE_DELETE: 'zones:delete',

  REVIEW_READ: 'reviews:read',
  REVIEW_CREATE: 'reviews:create',
  REVIEW_MODERATE: 'reviews:manage',

  COUPON_READ: 'coupons:read',
  COUPON_CREATE: 'coupons:create',
  COUPON_UPDATE: 'coupons:update',
  COUPON_MANAGE: 'coupons:manage',

  ADVERTISEMENT_READ: 'advertisements:read',
  ADVERTISEMENT_CREATE: 'advertisements:create',
  ADVERTISEMENT_UPDATE: 'advertisements:update',

  NOTIFICATION_READ: 'notifications:read',
  NOTIFICATION_MANAGE: 'notifications:manage',

  MESSAGE_READ: 'messages:read',
  MESSAGE_CREATE: 'messages:create',

  MEDIA_READ: 'media:read',
  MEDIA_UPLOAD: 'media:create',
  MEDIA_MANAGE: 'media:manage',

  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',

  REPORT_READ: 'reports:read',
  REPORT_EXPORT: 'reports:export',

  SUPPORT_READ: 'support:read',
  SUPPORT_MANAGE: 'support:manage',

  DISPUTE_READ: 'disputes:read',
  DISPUTE_MANAGE: 'disputes:manage',

  AUDIT_READ: 'audit:read',

  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
} as const satisfies Record<string, Permission>;

export type PermissionName = keyof typeof PERMISSIONS;

const CUSTOMER_PERMISSIONS = [
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.CATEGORY_READ,
  PERMISSIONS.STORE_READ,
  PERMISSIONS.RESTAURANT_READ,
  PERMISSIONS.CART_READ,
  PERMISSIONS.CART_MANAGE,
  PERMISSIONS.FAVORITE_READ,
  PERMISSIONS.FAVORITE_MANAGE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_CANCEL,
  PERMISSIONS.STORE_CREATE,
  PERMISSIONS.DRIVER_CREATE,
  PERMISSIONS.PAYMENT_READ,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.REVIEW_READ,
  PERMISSIONS.REVIEW_CREATE,
  PERMISSIONS.ZONE_READ,
  PERMISSIONS.ZONE_CREATE,
  PERMISSIONS.ZONE_UPDATE,
  PERMISSIONS.ZONE_DELETE,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.MESSAGE_READ,
  PERMISSIONS.MESSAGE_CREATE,
  PERMISSIONS.SUPPORT_READ,
  PERMISSIONS.SUPPORT_MANAGE,
  PERMISSIONS.USER_UPDATE,
] as const satisfies readonly Permission[];

const SELLER_PERMISSIONS = [
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_UPDATE,
  PERMISSIONS.PRODUCT_DELETE,
  PERMISSIONS.CATEGORY_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_UPDATE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.ORDER_UPDATE,
  PERMISSIONS.ORDER_CANCEL,
  PERMISSIONS.ANALYTICS_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.MESSAGE_READ,
  PERMISSIONS.MESSAGE_CREATE,
  PERMISSIONS.SUBSCRIPTION_READ,
  PERMISSIONS.INVOICE_READ,
  PERMISSIONS.REVIEW_READ,
  PERMISSIONS.SUPPORT_READ,
  PERMISSIONS.BUSINESS_READ,
  PERMISSIONS.BUSINESS_UPDATE,
] as const satisfies readonly Permission[];

const MERCHANT_PERMISSIONS = [
  ...SELLER_PERMISSIONS,
  PERMISSIONS.STORE_READ,
  PERMISSIONS.STORE_CREATE,
  PERMISSIONS.STORE_UPDATE,
  PERMISSIONS.STORE_MANAGE,
  PERMISSIONS.REVIEW_MODERATE,
] as const satisfies readonly Permission[];

const RESTAURANT_PERMISSIONS = [
  ...SELLER_PERMISSIONS,
  PERMISSIONS.RESTAURANT_READ,
  PERMISSIONS.RESTAURANT_CREATE,
  PERMISSIONS.RESTAURANT_UPDATE,
  PERMISSIONS.RESTAURANT_MANAGE,
  PERMISSIONS.DELIVERY_READ,
  PERMISSIONS.ASSIGNMENT_READ,
] as const satisfies readonly Permission[];

const DELIVERY_COMPANY_PERMISSIONS = [
  PERMISSIONS.DRIVER_READ,
  PERMISSIONS.DRIVER_CREATE,
  PERMISSIONS.DRIVER_UPDATE,
  PERMISSIONS.DRIVER_SUSPEND,
  PERMISSIONS.ASSIGNMENT_READ,
  PERMISSIONS.ASSIGNMENT_CREATE,
  PERMISSIONS.ASSIGNMENT_UPDATE,
  PERMISSIONS.DELIVERY_READ,
  PERMISSIONS.DELIVERY_UPDATE,
  PERMISSIONS.DELIVERY_MANAGE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.ZONE_READ,
  PERMISSIONS.ZONE_CREATE,
  PERMISSIONS.ANALYTICS_READ,
  PERMISSIONS.REPORT_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.MESSAGE_READ,
  PERMISSIONS.MESSAGE_CREATE,
  PERMISSIONS.INVOICE_READ,
  PERMISSIONS.SUBSCRIPTION_READ,
  PERMISSIONS.BUSINESS_READ,
  PERMISSIONS.BUSINESS_UPDATE,
  PERMISSIONS.PAYMENT_READ,
] as const satisfies readonly Permission[];

const DRIVER_PERMISSIONS = [
  PERMISSIONS.ASSIGNMENT_READ,
  PERMISSIONS.ASSIGNMENT_UPDATE,
  PERMISSIONS.DELIVERY_READ,
  PERMISSIONS.DELIVERY_UPDATE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.ZONE_READ,
  PERMISSIONS.PAYMENT_READ,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.MESSAGE_READ,
  PERMISSIONS.MESSAGE_CREATE,
  PERMISSIONS.USER_UPDATE,
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS = {
  customer: CUSTOMER_PERMISSIONS,
  merchant: MERCHANT_PERMISSIONS,
  restaurant: RESTAURANT_PERMISSIONS,
  delivery_company: DELIVERY_COMPANY_PERMISSIONS,
  driver: DRIVER_PERMISSIONS,
  admin: [],
} as const satisfies Record<UserRole, readonly Permission[]>;

export const ADMIN_DEPARTMENT_PERMISSIONS = {
  super_admin: [
    ...RESOURCES.flatMap((resource) =>
      ACTIONS.map((action) => `${resource}:${action}` as Permission),
    ),
  ],
  operations: [
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_EXPORT,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.DELIVERY_MANAGE,
    PERMISSIONS.ASSIGNMENT_READ,
    PERMISSIONS.ASSIGNMENT_UPDATE,
    PERMISSIONS.BUSINESS_READ,
    PERMISSIONS.DRIVER_READ,
    PERMISSIONS.DRIVER_UPDATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.SUPPORT_READ,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.DISPUTE_READ,
    PERMISSIONS.DISPUTE_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  finance: [
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_MANAGE,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.SUBSCRIPTION_READ,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_MANAGE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.BUSINESS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_READ,
  ],
  support: [
    PERMISSIONS.DRIVER_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.BUSINESS_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.SUPPORT_READ,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.DISPUTE_READ,
    PERMISSIONS.DELIVERY_READ,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  marketing: [
    PERMISSIONS.ADVERTISEMENT_READ,
    PERMISSIONS.ADVERTISEMENT_CREATE,
    PERMISSIONS.ADVERTISEMENT_UPDATE,
    PERMISSIONS.COUPON_READ,
    PERMISSIONS.COUPON_CREATE,
    PERMISSIONS.COUPON_UPDATE,
    PERMISSIONS.COUPON_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  content: [
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_MODERATE,
  ],
  moderation: [
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.BUSINESS_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.DISPUTE_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  security: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.BUSINESS_SUSPEND,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
  ],
} as const satisfies Record<AdminDepartment, readonly Permission[]>;

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function permissionsForAdminDepartment(department: AdminDepartment): readonly Permission[] {
  return ADMIN_DEPARTMENT_PERMISSIONS[department];
}

export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasEveryPermission(
  granted: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.every((permission) => granted.includes(permission));
}

export function hasAnyPermission(
  granted: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.some((permission) => granted.includes(permission));
}

export function permissionsForBusinessRole(role: BusinessRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
