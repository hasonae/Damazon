import type { BusinessRole } from '../identity/roles.js';

import { CURRENCIES, moneyFromMajor, type Money } from './money.js';

export const SUBSCRIPTION_PLANS = {
  MERCHANT_MONTHLY: 'merchant_monthly',
  RESTAURANT_MONTHLY: 'restaurant_monthly',
  DELIVERY_COMPANY_MONTHLY: 'delivery_company_monthly',
} as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

export const SUBSCRIPTION_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  GRACE_PERIOD: 'grace_period',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

export const ALL_SUBSCRIPTION_STATUSES = Object.values(
  SUBSCRIPTION_STATUSES,
) as readonly SubscriptionStatus[];

export const SUBSCRIPTION_CADENCES = { MONTHLY: 'monthly' } as const;

export type SubscriptionCadence =
  (typeof SUBSCRIPTION_CADENCES)[keyof typeof SUBSCRIPTION_CADENCES];

export const SUBSCRIPTION_PERIOD_MONTHS = 1;

export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 5;

export interface SubscriptionPlanDefinition {
  readonly plan: SubscriptionPlan;
  readonly businessRole: BusinessRole;
  readonly cadence: SubscriptionCadence;
  readonly price: Money;
  readonly gracePeriodDays: number;
  readonly autoRenew: boolean;
  readonly autoInvoice: boolean;
  readonly autoSuspend: boolean;
  readonly features: readonly string[];
}

export const SUBSCRIPTION_PLAN_DEFINITIONS = {
  [SUBSCRIPTION_PLANS.MERCHANT_MONTHLY]: {
    plan: SUBSCRIPTION_PLANS.MERCHANT_MONTHLY,
    businessRole: 'merchant',
    cadence: SUBSCRIPTION_CADENCES.MONTHLY,
    price: moneyFromMajor(500, CURRENCIES.SYP),
    gracePeriodDays: SUBSCRIPTION_GRACE_PERIOD_DAYS,
    autoRenew: true,
    autoInvoice: true,
    autoSuspend: true,
    features: ['store_listing', 'unlimited_products', 'order_management', 'analytics', 'support'],
  },
  [SUBSCRIPTION_PLANS.RESTAURANT_MONTHLY]: {
    plan: SUBSCRIPTION_PLANS.RESTAURANT_MONTHLY,
    businessRole: 'restaurant',
    cadence: SUBSCRIPTION_CADENCES.MONTHLY,
    price: moneyFromMajor(500, CURRENCIES.SYP),
    gracePeriodDays: SUBSCRIPTION_GRACE_PERIOD_DAYS,
    autoRenew: true,
    autoInvoice: true,
    autoSuspend: true,
    features: ['menu_management', 'kitchen_workflow', 'order_management', 'analytics', 'support'],
  },
  [SUBSCRIPTION_PLANS.DELIVERY_COMPANY_MONTHLY]: {
    plan: SUBSCRIPTION_PLANS.DELIVERY_COMPANY_MONTHLY,
    businessRole: 'delivery_company',
    cadence: SUBSCRIPTION_CADENCES.MONTHLY,
    price: moneyFromMajor(100, CURRENCIES.SYP),
    gracePeriodDays: SUBSCRIPTION_GRACE_PERIOD_DAYS,
    autoRenew: true,
    autoInvoice: true,
    autoSuspend: true,
    features: ['fleet_management', 'driver_management', 'assignment_engine', 'reports'],
  },
} as const satisfies Record<SubscriptionPlan, SubscriptionPlanDefinition>;

export const SUBSCRIPTION_TRANSITIONS = {
  [SUBSCRIPTION_STATUSES.PENDING]: [SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.CANCELLED],
  [SUBSCRIPTION_STATUSES.ACTIVE]: [
    SUBSCRIPTION_STATUSES.PAST_DUE,
    SUBSCRIPTION_STATUSES.CANCELLED,
    SUBSCRIPTION_STATUSES.SUSPENDED,
  ],
  [SUBSCRIPTION_STATUSES.PAST_DUE]: [
    SUBSCRIPTION_STATUSES.ACTIVE,
    SUBSCRIPTION_STATUSES.GRACE_PERIOD,
    SUBSCRIPTION_STATUSES.SUSPENDED,
  ],
  [SUBSCRIPTION_STATUSES.GRACE_PERIOD]: [
    SUBSCRIPTION_STATUSES.ACTIVE,
    SUBSCRIPTION_STATUSES.SUSPENDED,
  ],
  [SUBSCRIPTION_STATUSES.SUSPENDED]: [
    SUBSCRIPTION_STATUSES.ACTIVE,
    SUBSCRIPTION_STATUSES.CANCELLED,
    SUBSCRIPTION_STATUSES.EXPIRED,
  ],
  [SUBSCRIPTION_STATUSES.CANCELLED]: [],
  [SUBSCRIPTION_STATUSES.EXPIRED]: [],
} as const satisfies Record<SubscriptionStatus, readonly SubscriptionStatus[]>;

export function planForBusinessRole(role: BusinessRole): SubscriptionPlanDefinition {
  const definition = Object.values(SUBSCRIPTION_PLAN_DEFINITIONS).find(
    (candidate) => candidate.businessRole === role,
  );
  if (!definition) {
    throw new Error(`No subscription plan is defined for business role: ${role}`);
  }
  return definition;
}

export function isSubscriptionTransitionAllowed(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  return (SUBSCRIPTION_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): void {
  if (!isSubscriptionTransitionAllowed(from, to)) {
    throw new Error(`Illegal subscription transition: ${from} -> ${to}`);
  }
}

export function subscriptionBlocksCommerce(status: SubscriptionStatus): boolean {
  return (
    status === SUBSCRIPTION_STATUSES.SUSPENDED ||
    status === SUBSCRIPTION_STATUSES.CANCELLED ||
    status === SUBSCRIPTION_STATUSES.EXPIRED
  );
}
