import type { OrderStatus } from '@damazon/shared-types';
import { z } from 'zod';

export const adminBusinessIdSchema = z.string().uuid();

export const rejectBusinessSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();

export const cashSubscriptionConfirmationSchema = z
  .object({
    cashReceived: z.literal(true),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type RejectBusinessRequest = z.infer<typeof rejectBusinessSchema>;
export type CashSubscriptionConfirmationRequest = z.infer<
  typeof cashSubscriptionConfirmationSchema
>;

export interface AdminOrderView {
  readonly id: string;
  readonly orderNumber: string;
  readonly business: string;
  readonly city: string;
  readonly status: OrderStatus;
  readonly totalMinorUnits: string;
  readonly currency: string;
  readonly createdAt: string;
}

export interface AdminBusinessReviewView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly verificationStatus: string;
  readonly businessStatus: string;
  readonly subscriptionSuspendedAt: string | null;
  readonly ownerName: string;
  readonly ownerPhone: string;
  readonly city: string;
  readonly documentCount: number;
  readonly approvedDocumentCount: number;
  readonly subscriptionStatus: string | null;
  readonly subscriptionAmount: number | null;
  readonly subscriptionCurrency: string | null;
  readonly subscriptionPeriodEnd: string | null;
  readonly hasActiveSubscription: boolean;
  readonly createdAt: string;
}

export interface AdminDashboardView {
  readonly totalOrders: number;
  readonly openOrders: number;
  readonly activeBusinesses: number;
  readonly businessesAwaitingReview: number;
  readonly recentOrders: readonly AdminOrderView[];
}

export interface AdminUserView {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly status: string;
  readonly roles: readonly string[];
  readonly activeBusinessId: string | null;
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export const updateUserStatusSchema = z
  .object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']) })
  .strict();

export type UpdateUserStatusRequest = z.infer<typeof updateUserStatusSchema>;

export interface AdminDriverView {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string;
  readonly status: string;
  readonly applicationStatus: string;
  readonly vehicleType: string;
  readonly completedDeliveries: number;
  readonly companyId: string | null;
  readonly companyName: string | null;
}

export const approveDriverApplicationSchema = z
  .object({ companyBusinessId: z.string().uuid() })
  .strict();
export const rejectDriverApplicationSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();
export type ApproveDriverApplicationRequest = z.infer<typeof approveDriverApplicationSchema>;
export type RejectDriverApplicationRequest = z.infer<typeof rejectDriverApplicationSchema>;

export const updateDriverStatusSchema = z
  .object({ status: z.enum(['available', 'offline', 'on_break', 'suspended']) })
  .strict();

export type UpdateDriverStatusRequest = z.infer<typeof updateDriverStatusSchema>;

export interface AdminAuditLogView {
  readonly id: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly actorRole: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly newValue: unknown;
  readonly createdAt: string;
}

export interface AdminAuditLogPage {
  readonly items: readonly AdminAuditLogView[];
  readonly meta: {
    readonly limit: number;
    readonly hasMore: boolean;
    readonly nextCursor: string | null;
    readonly totalCount: number;
  };
}

export const listAuditLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(512).optional(),
    actorId: z.string().uuid().optional(),
    entityType: z.string().optional(),
  })
  .strict();

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
