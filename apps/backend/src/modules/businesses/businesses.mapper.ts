import type { Prisma } from '@prisma/client';

import { isBusinessRole, USER_ROLES, type UserRole } from '@damazon/shared-types';
import { BusinessRuleViolationError } from '../../common/errors/domain.error.js';
import type { BusinessDetail, BusinessSummary } from './dto/businesses.dto.js';

export const businessListSelect = {
  id: true,
  type: true,
  name: true,
  logoUrl: true,
  coverImageUrl: true,
  status: true,
  verificationStatus: true,
  subscriptionSuspendedAt: true,
  ratingAverage: true,
  ratingCount: true,
  subscriptions: {
    orderBy: { periodEnd: 'desc' },
    take: 1,
    select: { status: true, amountMinor: true, currency: true, periodEnd: true },
  },
  createdAt: true,
} satisfies Prisma.BusinessSelect;

export type BusinessListRow = Prisma.BusinessGetPayload<{ select: typeof businessListSelect }>;

export const businessDetailSelect = {
  ...businessListSelect,
  description: true,
  phone: true,
  email: true,
  addressLine: true,
  latitude: true,
  longitude: true,
  ownerId: true,
  city: { select: { id: true, nameAr: true, nameEn: true } },
} satisfies Prisma.BusinessSelect;

export type BusinessDetailRow = Prisma.BusinessGetPayload<{ select: typeof businessDetailSelect }>;

export function toBusinessSummary(row: BusinessListRow): BusinessSummary {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    verificationStatus: row.verificationStatus,
    subscriptionSuspendedAt: row.subscriptionSuspendedAt?.toISOString() ?? null,
    ratingAverage: String(row.ratingAverage),
    ratingCount: row.ratingCount,
    subscription:
      row.subscriptions[0] === undefined
        ? null
        : {
            status: row.subscriptions[0].status,
            amount: row.subscriptions[0].amountMinor,
            currency: row.subscriptions[0].currency,
            periodEnd: row.subscriptions[0].periodEnd.toISOString(),
          },
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBusinessDetail(row: BusinessDetailRow, viewerId: string): BusinessDetail {
  const summary = toBusinessSummary(row);
  return {
    ...summary,
    subscription: row.ownerId === viewerId ? summary.subscription : null,
    description: row.description,
    phone: row.phone,
    email: row.email,
    city: row.city,
    addressLine: row.addressLine,
    latitude: row.latitude === null ? null : String(row.latitude),
    longitude: row.longitude === null ? null : String(row.longitude),
    isOwner: row.ownerId === viewerId,
  };
}

export function toBusinessRole(type: string): UserRole {
  if (!isBusinessRole(type)) {
    throw new BusinessRuleViolationError(`Unsupported business type: ${type}`);
  }
  return type === 'merchant'
    ? USER_ROLES.MERCHANT
    : type === 'restaurant'
      ? USER_ROLES.RESTAURANT
      : USER_ROLES.DELIVERY_COMPANY;
}
