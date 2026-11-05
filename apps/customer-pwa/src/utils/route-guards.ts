import type { UserRole } from '@damazon/shared-types';

export interface RoleModeDescriptor {
  readonly role: UserRole;
  readonly landingRoute: string;
  readonly navigationKeys: readonly string[];
  readonly showsConsumerSurfaces: boolean;
}

export const ROLE_MODES: Readonly<Record<UserRole, RoleModeDescriptor>> = {
  customer: {
    role: 'customer',
    landingRoute: '/',
    navigationKeys: ['nav.home', 'nav.search', 'nav.orders', 'nav.cart', 'nav.profile'],
    showsConsumerSurfaces: true,
  },
  merchant: {
    role: 'merchant',
    landingRoute: '/merchant',
    navigationKeys: ['nav.home', 'nav.orders', 'nav.profile'],
    showsConsumerSurfaces: false,
  },
  restaurant: {
    role: 'restaurant',
    landingRoute: '/restaurant',
    navigationKeys: ['nav.home', 'nav.orders', 'nav.profile'],
    showsConsumerSurfaces: false,
  },
  delivery_company: {
    role: 'delivery_company',
    landingRoute: '/delivery-company',
    navigationKeys: ['nav.orders', 'nav.profile'],
    showsConsumerSurfaces: false,
  },
  driver: {
    role: 'driver',
    landingRoute: '/driver',
    navigationKeys: ['nav.orders', 'nav.profile'],
    showsConsumerSurfaces: false,
  },
  admin: {
    role: 'admin',
    landingRoute: '/profile',
    // The admin role exists in a consumer account only for identity purposes.
    // Administrative work happens in the separate console (ADR-0008), so this
    // PWA deliberately has no administrative route.
    navigationKeys: ['nav.home', 'nav.profile'],
    showsConsumerSurfaces: false,
  },
};

export function modeForRole(role: UserRole | null): RoleModeDescriptor {
  return role === null ? ROLE_MODES.customer : ROLE_MODES[role];
}

/** Routes that require a session. */
export const PROTECTED_ROUTE_PREFIXES: readonly string[] = [
  '/cart',
  '/checkout',
  '/orders',
  '/favorites',
  '/profile',
  '/zones',
  '/merchant',
  '/restaurant',
  '/delivery-company',
  '/driver',
];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
