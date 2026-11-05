import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditAction, type Prisma } from '@prisma/client';
import {
  ALL_ORDER_STATUSES,
  buildPage,
  decodeCursor,
  encodeCursor,
  isTerminalOrderStatus,
  type PaginatedResult,
} from '@damazon/shared-types';

import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
  ValidationFailedError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import { toBusinessRole } from '../businesses/businesses.mapper.js';
import type { ListOrdersQuery } from '../orders/dto/orders.dto.js';
import type {
  AdminBusinessReviewView,
  AdminDashboardView,
  AdminDriverView,
  AdminOrderView,
  AdminUserView,
  AdminAuditLogPage,
  ListAuditLogsQuery,
} from './dto/admin.dto.js';

const BUSINESS_SUBSCRIPTION_AMOUNT = 500;
const BUSINESS_SUBSCRIPTION_CURRENCY = 'SYP';
const BUSINESS_SUBSCRIPTION_DAYS = 30;

const ORDER_LIST_INCLUDE = {
  business: {
    select: { name: true, city: { select: { nameAr: true, nameEn: true } } },
  },
} as const;

type AdminOrderRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

function toAdminOrder(row: AdminOrderRecord): AdminOrderView {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    business: row.business.name,
    city: row.business.city?.nameAr ?? row.business.city?.nameEn ?? '—',
    status: row.status,
    totalMinorUnits: String(row.totalMinor),
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async dashboard(): Promise<AdminDashboardView> {
    const openStatuses = ALL_ORDER_STATUSES.filter((status) => !isTerminalOrderStatus(status));

    const [totalOrders, openOrders, activeBusinesses, businessesAwaitingReview, recentOrders] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: { in: openStatuses } } }),
        this.prisma.business.count({
          where: { status: 'ACTIVE', verificationStatus: 'APPROVED' },
        }),
        this.prisma.business.count({
          where: { verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] } },
        }),
        this.prisma.order.findMany({
          include: ORDER_LIST_INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
        }),
      ]);

    return {
      totalOrders,
      openOrders,
      activeBusinesses,
      businessesAwaitingReview,
      recentOrders: recentOrders.map(toAdminOrder),
    };
  }

  public async listOrders(query: ListOrdersQuery): Promise<PaginatedResult<AdminOrderView>> {
    const where = query.status === undefined ? {} : { status: query.status };
    const keysetWhere: Prisma.OrderWhereInput = { ...where };
    if (query.cursor !== undefined) {
      try {
        const { createdAt, id } = decodeCursor(query.cursor);
        keysetWhere.AND = [
          { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] },
        ];
      } catch {
        throw new ValidationFailedError([
          { field: 'query.cursor', message: 'Invalid cursor', code: 'invalid_format' },
        ]);
      }
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.order.findMany({
        where: keysetWhere,
        include: ORDER_LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      }),
      this.prisma.order.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return buildPage(
      page.map(toAdminOrder),
      query.limit,
      hasMore,
      hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
      totalItems,
    );
  }

  public async listBusinessesForReview(): Promise<readonly AdminBusinessReviewView[]> {
    const now = new Date();
    const businesses = await this.prisma.business.findMany({
      where: { status: { not: 'CLOSED' } },
      include: {
        owner: { select: { firstName: true, lastName: true, phone: true } },
        city: { select: { nameAr: true, nameEn: true } },
        documents: { select: { verificationStatus: true } },
        subscriptions: {
          where: { status: { in: ['active', 'pending'] } },
          orderBy: { periodEnd: 'desc' },
          select: {
            id: true,
            status: true,
            amountMinor: true,
            currency: true,
            periodStart: true,
            periodEnd: true,
          },
          take: 100,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return businesses.map((business) => ({
      id: business.id,
      name: business.name,
      type: business.type,
      verificationStatus: business.verificationStatus,
      businessStatus: business.status,
      subscriptionSuspendedAt: business.subscriptionSuspendedAt?.toISOString() ?? null,
      ownerName: `${business.owner.firstName} ${business.owner.lastName}`,
      ownerPhone: business.owner.phone,
      city: business.city?.nameAr ?? business.city?.nameEn ?? '—',
      documentCount: business.documents.length,
      approvedDocumentCount: business.documents.filter(
        (document) => document.verificationStatus === 'APPROVED',
      ).length,
      subscriptionStatus: business.subscriptions[0]?.status ?? null,
      subscriptionAmount: business.subscriptions[0]?.amountMinor ?? null,
      subscriptionCurrency: business.subscriptions[0]?.currency ?? null,
      subscriptionPeriodEnd:
        business.subscriptions
          .find((subscription) => subscription.status === 'active')
          ?.periodEnd.toISOString() ??
        business.subscriptions[0]?.periodEnd.toISOString() ??
        null,
      hasActiveSubscription: business.subscriptions.some(
        (subscription) =>
          subscription.status === 'active' &&
          subscription.periodStart <= now &&
          subscription.periodEnd > now,
      ),
      createdAt: business.createdAt.toISOString(),
    }));
  }

  public async approveBusiness(businessId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(
      async (client) => {
        const business = await client.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            name: true,
            ownerId: true,
            type: true,
            verificationStatus: true,
          },
        });
        if (business === null) {
          throw new ResourceNotFoundError('Business', businessId);
        }
        if (
          business.verificationStatus !== 'PENDING' &&
          business.verificationStatus !== 'UNDER_REVIEW'
        ) {
          throw new BusinessRuleViolationError(
            'Only pending business applications can be approved',
          );
        }

        const updatedBusiness = await client.business.updateMany({
          where: {
            id: business.id,
            verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
          data: { verificationStatus: 'APPROVED', verifiedAt: new Date() },
        });
        if (updatedBusiness.count !== 1) {
          throw new BusinessRuleViolationError('The business application was already reviewed');
        }
        const assignment = await client.userRoleAssignment.updateMany({
          where: {
            userId: business.ownerId,
            role: toBusinessRole(business.type),
            status: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
          data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date() },
        });
        if (assignment.count !== 1) {
          throw new BusinessRuleViolationError('The business owner role is not awaiting approval');
        }
        await client.notification.create({
          data: {
            userId: business.ownerId,
            type: 'business',
            titleEn: 'Business application approved',
            titleAr: 'تمت الموافقة على طلب النشاط التجاري',
            bodyEn: `Your application for ${business.name} was approved. Pay 500 SYP in cash to Damazon administration to activate it.`,
            bodyAr: `تمت الموافقة على طلب ${business.name}. راجع إدارة دامازون لدفع الاشتراك البالغ 500 ليرة سورية جديدة نقداً وتفعيل النشاط.`,
            data: { businessId: business.id, status: 'approved' },
            dedupeKey: `business-approved:${business.id}`,
          },
        });
        await client.auditLog.create({
          data: {
            actorId: adminId,
            actorRole: 'admin',
            action: 'approve',
            entityType: 'Business',
            entityId: business.id,
            newValue: { verificationStatus: 'APPROVED', businessStatus: 'DRAFT' },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async rejectBusiness(businessId: string, adminId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(
      async (client) => {
        const business = await client.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            name: true,
            ownerId: true,
            type: true,
            verificationStatus: true,
          },
        });
        if (business === null) {
          throw new ResourceNotFoundError('Business', businessId);
        }
        if (
          business.verificationStatus !== 'PENDING' &&
          business.verificationStatus !== 'UNDER_REVIEW'
        ) {
          throw new BusinessRuleViolationError(
            'Only pending business applications can be rejected',
          );
        }

        const updatedBusiness = await client.business.updateMany({
          where: {
            id: business.id,
            verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
          data: { verificationStatus: 'REJECTED' },
        });
        if (updatedBusiness.count !== 1) {
          throw new BusinessRuleViolationError('The business application was already reviewed');
        }
        const assignment = await client.userRoleAssignment.updateMany({
          where: {
            userId: business.ownerId,
            role: toBusinessRole(business.type),
            status: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
          data: {
            status: 'REJECTED',
            statusReasonCode: 'business_rejected',
            statusNote: reason,
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        });
        if (assignment.count !== 1) {
          throw new BusinessRuleViolationError('The business owner role is not awaiting review');
        }
        await client.notification.create({
          data: {
            userId: business.ownerId,
            type: 'business',
            titleEn: 'Business application needs changes',
            titleAr: 'لم تتم الموافقة على طلب النشاط',
            bodyEn: `Your application for ${business.name} was not approved. Reason: ${reason}`,
            bodyAr: `لم تتم الموافقة على طلب ${business.name}. السبب: ${reason}`,
            data: { businessId: business.id, status: 'rejected', reason },
            dedupeKey: `business-rejected:${business.id}`,
          },
        });
        await client.auditLog.create({
          data: {
            actorId: adminId,
            actorRole: 'admin',
            action: 'reject',
            entityType: 'Business',
            entityId: business.id,
            newValue: { verificationStatus: 'REJECTED', reason },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async confirmCashSubscription(
    businessId: string,
    adminId: string,
    note?: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (client) => {
        const business = await client.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            ownerId: true,
            type: true,
            status: true,
            verificationStatus: true,
            subscriptionSuspendedAt: true,
            owner: { select: { locale: true } },
          },
        });
        if (business === null) {
          throw new ResourceNotFoundError('Business', businessId);
        }
        if (business.verificationStatus !== 'APPROVED') {
          throw new BusinessRuleViolationError(
            'Approve the business before activating a subscription',
          );
        }
        if (business.status === 'CLOSED') {
          throw new BusinessRuleViolationError('A closed business cannot be reactivated');
        }

        const now = new Date();
        const alreadyRenewed = await client.businessSubscription.findFirst({
          where: { businessId, status: 'pending', periodEnd: { gt: now } },
          select: { id: true },
        });
        if (alreadyRenewed !== null) {
          throw new BusinessRuleViolationError(
            'A cash renewal has already been recorded for the next subscription period',
          );
        }
        const current = await client.businessSubscription.findFirst({
          where: {
            businessId,
            status: 'active',
            periodStart: { lte: now },
            periodEnd: { gt: now },
          },
          orderBy: { periodEnd: 'desc' },
          select: { periodEnd: true },
        });
        const periodStart = current?.periodEnd ?? now;
        const periodEnd = new Date(
          periodStart.getTime() + BUSINESS_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000,
        );
        const subscription = await client.businessSubscription.create({
          data: {
            businessId,
            plan:
              business.type === 'restaurant'
                ? 'restaurant_monthly'
                : business.type === 'delivery_company'
                  ? 'delivery_company_monthly'
                  : 'merchant_monthly',
            status: current === null ? 'active' : 'pending',
            amountMinor: BUSINESS_SUBSCRIPTION_AMOUNT,
            currency: BUSINESS_SUBSCRIPTION_CURRENCY,
            periodStart,
            periodEnd,
            autoRenew: false,
          },
        });
        const invoice = await client.invoice.create({
          data: {
            businessId,
            subscriptionId: subscription.id,
            invoiceNumber: `SUB-${randomUUID()}`,
            status: 'paid',
            amountMinor: BUSINESS_SUBSCRIPTION_AMOUNT,
            currency: BUSINESS_SUBSCRIPTION_CURRENCY,
            issuedAt: now,
            paidAt: now,
            dueAt: now,
          },
        });
        const payment = await client.payment.create({
          data: {
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            userId: business.ownerId,
            method: 'cash_subscription',
            status: 'succeeded',
            amountMinor: BUSINESS_SUBSCRIPTION_AMOUNT,
            currency: BUSINESS_SUBSCRIPTION_CURRENCY,
            gateway: 'cash',
            transactionReference: `CASH-SUB-${randomUUID()}`,
            verifiedAt: now,
          },
        });
        await client.paymentLog.create({
          data: {
            paymentId: payment.id,
            event: 'cash_subscription_received',
            toStatus: 'succeeded',
            data: { receivedByAdminId: adminId, note: note ?? null },
          },
        });
        if (
          current === null &&
          (business.status === 'DRAFT' || business.subscriptionSuspendedAt !== null)
        ) {
          await client.business.update({
            where: { id: business.id },
            data: { status: 'ACTIVE', subscriptionSuspendedAt: null },
          });
        }
        if (business.type === 'delivery_company') {
          await client.deliveryCompany.upsert({
            where: { businessId },
            create: { businessId, isOperational: true },
            update: { isOperational: true },
          });
        }
        await client.notification.create({
          data: {
            userId: business.ownerId,
            type: 'subscription',
            titleEn: 'Business subscription received',
            titleAr: 'تم تأكيد اشتراك النشاط التجاري',
            bodyEn: `Cash payment of 500 SYP was recorded. Your subscription is valid until ${periodEnd.toISOString()}.`,
            bodyAr: `تم تسجيل دفع نقدي بقيمة 500 ليرة سورية جديدة. اشتراكك صالح حتى ${periodEnd.toISOString()}.`,
            data: { businessId: business.id, subscriptionId: subscription.id },
            dedupeKey: `subscription-paid:${subscription.id}`,
          },
        });
        await client.auditLog.create({
          data: {
            actorId: adminId,
            actorRole: 'admin',
            action: 'update',
            entityType: 'BusinessSubscription',
            entityId: subscription.id,
            newValue: {
              businessId,
              paymentId: payment.id,
              invoiceId: invoice.id,
              amount: BUSINESS_SUBSCRIPTION_AMOUNT,
              currency: BUSINESS_SUBSCRIPTION_CURRENCY,
              periodStart: periodStart.toISOString(),
              periodEnd: periodEnd.toISOString(),
              paymentMode: 'cash',
              note: note ?? null,
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async listUsers(query: { limit: number; cursor: string | undefined }): Promise<{
    readonly items: readonly AdminUserView[];
    readonly meta: {
      readonly limit: number;
      readonly hasMore: boolean;
      readonly nextCursor: string | null;
      readonly totalCount: number;
    };
  }> {
    const [rows, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        include: {
          roles: { select: { role: true } },
          ownedBusinesses: { select: { id: true }, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.user.count(),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        status: user.status,
        roles: user.roles.map((r) => r.role),
        activeBusinessId: user.ownedBusinesses[0]?.id ?? null,
        phoneVerified: user.phoneVerifiedAt !== null,
        emailVerified: user.emailVerifiedAt !== null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      })),
      meta: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore && last !== undefined ? last.id : null,
        totalCount: totalItems,
      },
    };
  }

  public async updateUserStatus(
    userId: string,
    adminId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED',
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) {
      throw new ResourceNotFoundError('User', userId);
    }
    await this.prisma.$transaction(
      async (client) => {
        await client.user.update({
          where: { id: userId },
          data: { status },
        });
        await client.auditLog.create({
          data: {
            actorId: adminId,
            actorRole: 'admin',
            action:
              status === 'SUSPENDED' || status === 'BLOCKED'
                ? AuditAction.suspend
                : AuditAction.update,
            entityType: 'User',
            entityId: userId,
            newValue: { status },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async listDrivers(): Promise<readonly AdminDriverView[]> {
    const drivers = await this.prisma.driver.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            roles: { where: { role: 'driver' }, select: { status: true } },
          },
        },
        company: { select: { business: { select: { name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return drivers.map((driver) => ({
      id: driver.id,
      userId: driver.userId,
      name: `${driver.user.firstName} ${driver.user.lastName}`,
      phone: driver.user.phone,
      status: driver.status,
      applicationStatus: driver.user.roles[0]?.status ?? 'APPROVED',
      vehicleType: driver.vehicleType,
      completedDeliveries: driver.completedDeliveries,
      companyId: driver.companyId,
      companyName: driver.company?.business.name ?? null,
    }));
  }

  public async approveDriverApplication(
    driverId: string,
    adminId: string,
    companyBusinessId: string,
  ): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, userId: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver', driverId);
    }
    const assignment = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_role: { userId: driver.userId, role: 'driver' } },
      select: { status: true },
    });
    if (assignment?.status !== 'PENDING' && assignment?.status !== 'UNDER_REVIEW') {
      throw new BusinessRuleViolationError('Only pending driver applications can be approved');
    }

    const now = new Date();
    const business = await this.prisma.business.findFirst({
      where: {
        id: companyBusinessId,
        type: 'delivery_company',
        status: 'ACTIVE',
        verificationStatus: 'APPROVED',
        subscriptions: {
          some: { status: 'active', periodStart: { lte: now }, periodEnd: { gt: now } },
        },
        deliveryCompany: { is: { isOperational: true } },
      },
      select: { id: true, deliveryCompany: { select: { id: true } } },
    });
    if (business === null || business.deliveryCompany === null) {
      throw new ResourceNotFoundError('Operational delivery company', companyBusinessId);
    }
    const deliveryCompanyId = business.deliveryCompany.id;

    await this.prisma.transaction(async (client) => {
      const reviewed = await client.userRoleAssignment.updateMany({
        where: {
          userId: driver.userId,
          role: 'driver',
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        },
        data: {
          status: 'APPROVED',
          activeBusinessId: business.id,
          reviewedById: adminId,
          reviewedAt: now,
          statusReasonCode: null,
          statusNote: null,
        },
      });
      if (reviewed.count !== 1) {
        throw new BusinessRuleViolationError('The driver application has already been reviewed');
      }
      await client.driver.update({
        where: { id: driver.id },
        data: { companyId: deliveryCompanyId, status: 'offline' },
      });
      await client.notification.create({
        data: {
          userId: driver.userId,
          type: 'business',
          titleEn: 'Driver application approved',
          titleAr: 'تمت الموافقة على طلب السائق',
          bodyEn: 'Your driver application has been approved. You can now switch to driver mode.',
          bodyAr: 'تمت الموافقة على طلبك كسائق. يمكنك الآن التبديل إلى وضع السائق.',
          data: { driverId: driver.id, companyBusinessId: business.id },
        },
      });
      await client.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: 'admin',
          action: AuditAction.approve,
          entityType: 'Driver',
          entityId: driver.id,
          newValue: { status: 'APPROVED', companyBusinessId: business.id },
        },
      });
    });
  }

  public async rejectDriverApplication(
    driverId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, userId: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver', driverId);
    }
    await this.prisma.transaction(async (client) => {
      const reviewed = await client.userRoleAssignment.updateMany({
        where: {
          userId: driver.userId,
          role: 'driver',
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        },
        data: {
          status: 'REJECTED',
          reviewedById: adminId,
          reviewedAt: new Date(),
          statusReasonCode: 'driver_application_rejected',
          statusNote: reason,
        },
      });
      if (reviewed.count !== 1) {
        throw new BusinessRuleViolationError('Only pending driver applications can be rejected');
      }
      await client.driver.update({
        where: { id: driver.id },
        data: { companyId: null, status: 'offline' },
      });
      await client.notification.create({
        data: {
          userId: driver.userId,
          type: 'business',
          titleEn: 'Driver application update',
          titleAr: 'تحديث طلب السائق',
          bodyEn: `Your driver application was not approved: ${reason}`,
          bodyAr: `لم تتم الموافقة على طلبك كسائق: ${reason}`,
          data: { driverId: driver.id, status: 'REJECTED' },
        },
      });
      await client.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: 'admin',
          action: AuditAction.reject,
          entityType: 'Driver',
          entityId: driver.id,
          newValue: { status: 'REJECTED', reason },
        },
      });
    });
  }

  public async updateDriverStatus(
    driverId: string,
    adminId: string,
    status: 'available' | 'offline' | 'on_break' | 'suspended',
  ): Promise<void> {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver', driverId);
    }
    const assignment = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_role: { userId: driver.userId, role: 'driver' } },
      select: { status: true },
    });
    if (assignment !== null && assignment.status !== 'APPROVED') {
      throw new BusinessRuleViolationError(
        'The driver must be approved before changing operational status',
      );
    }
    await this.prisma.$transaction(
      async (client) => {
        await client.driver.update({
          where: { id: driverId },
          data: { status },
        });
        await client.auditLog.create({
          data: {
            actorId: adminId,
            actorRole: 'admin',
            action: status === 'suspended' ? AuditAction.suspend : AuditAction.update,
            entityType: 'Driver',
            entityId: driverId,
            newValue: { status },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  public async listAuditLogs(
    query: ListAuditLogsQuery,
    actorIdFilter: string | undefined,
  ): Promise<AdminAuditLogPage> {
    const where: Prisma.AuditLogWhereInput = {};
    if (actorIdFilter !== undefined) {
      where.actorId = actorIdFilter;
    }
    if (query.entityType !== undefined) {
      where.entityType = query.entityType;
    }

    const [rows, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { firstName: true, lastName: true, phone: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: log.actor !== null ? `${log.actor.firstName} ${log.actor.lastName}` : null,
        actorRole: log.actorRole,
        action: log.action as string,
        entityType: log.entityType,
        entityId: log.entityId,
        newValue: log.newValue,
        createdAt: log.createdAt.toISOString(),
      })),
      meta: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore && last !== undefined ? last.id : null,
        totalCount: totalItems,
      },
    };
  }
}
