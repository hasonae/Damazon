import { describe, expect, it, vi } from 'vitest';

import { ValidationFailedError } from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { AdminService } from '../src/modules/admin/admin.service.js';

function createPrismaFake() {
  const prisma = {
    order: {
      count: vi.fn().mockResolvedValue(12),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'DMZ-TEST0001',
          status: 'confirmed',
          totalMinor: 12000,
          currency: 'SYP',
          createdAt: new Date('2026-10-18T00:00:00.000Z'),
          business: { name: 'Store', city: { nameAr: 'دمشق', nameEn: 'Damascus' } },
        },
      ]),
    },
    business: {
      count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(3),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'business-1',
          name: 'Store',
          type: 'merchant',
          verificationStatus: 'PENDING',
          status: 'DRAFT',
          owner: { firstName: 'Owner', lastName: 'One', phone: '+963941000001' },
          city: { nameAr: 'دمشق', nameEn: 'Damascus' },
          documents: [{ verificationStatus: 'APPROVED' }, { verificationStatus: 'PENDING' }],
          subscriptions: [],
          createdAt: new Date('2026-10-18T00:00:00.000Z'),
        },
      ]),
    },
  };
  return { prisma: prisma as unknown as PrismaService, raw: prisma };
}

describe('AdminService', () => {
  it('returns persisted aggregate metrics and recent order rows', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new AdminService(prisma);

    const result = await service.dashboard();

    expect(result.totalOrders).toBe(12);
    expect(result.openOrders).toBe(12);
    expect(result.activeBusinesses).toBe(4);
    expect(result.businessesAwaitingReview).toBe(3);
    expect(result.recentOrders[0]).toMatchObject({
      orderNumber: 'DMZ-TEST0001',
      city: 'دمشق',
      totalMinorUnits: '12000',
      currency: 'SYP',
    });
    expect(raw.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    );
  });

  it('applies cursor pagination for administrative order listings', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new AdminService(prisma);

    const page = await service.listOrders({ limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.meta.totalCount).toBe(12);
    expect(raw.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, take: 21 }),
    );
  });

  it('rejects malformed administrative order cursors', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new AdminService(prisma);

    await expect(service.listOrders({ limit: 20, cursor: 'broken' })).rejects.toBeInstanceOf(
      ValidationFailedError,
    );
    expect(raw.order.findMany).not.toHaveBeenCalled();
  });

  it('includes document and subscription readiness in business review data', async () => {
    const { prisma } = createPrismaFake();
    const service = new AdminService(prisma);

    const businesses = await service.listBusinessesForReview();

    expect(businesses[0]).toMatchObject({
      name: 'Store',
      documentCount: 2,
      approvedDocumentCount: 1,
      hasActiveSubscription: false,
    });
  });

  it('approves a driver only through an active delivery company and records the assignment', async () => {
    const tx = {
      userRoleAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      driver: { update: vi.fn().mockResolvedValue(undefined) },
      notification: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      driver: {
        findUnique: vi.fn().mockResolvedValue({ id: 'driver-1', userId: 'driver-user-1' }),
      },
      userRoleAssignment: {
        findUnique: vi.fn().mockResolvedValue({ status: 'PENDING' }),
      },
      business: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'business-1',
          deliveryCompany: { id: 'company-1' },
        }),
      },
      transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await service.approveDriverApplication('driver-1', 'admin-1', 'business-1');

    expect(prisma.business.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'business-1',
          type: 'delivery_company',
          status: 'ACTIVE',
          verificationStatus: 'APPROVED',
        }),
      }),
    );
    expect(tx.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'driver-1' },
        data: { companyId: 'company-1', status: 'offline' },
      }),
    );
    expect(tx.userRoleAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['PENDING', 'UNDER_REVIEW'] } }),
        data: expect.objectContaining({ status: 'APPROVED', activeBusinessId: 'business-1' }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('rejects pending driver applications and leaves the driver offline and unassigned', async () => {
    const tx = {
      userRoleAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      driver: { update: vi.fn().mockResolvedValue(undefined) },
      notification: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      driver: {
        findUnique: vi.fn().mockResolvedValue({ id: 'driver-1', userId: 'driver-user-1' }),
      },
      transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await service.rejectDriverApplication('driver-1', 'admin-1', 'Documents could not be verified');

    expect(tx.userRoleAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'driver-user-1',
          role: 'driver',
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        }),
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewedById: 'admin-1',
          statusReasonCode: 'driver_application_rejected',
          statusNote: 'Documents could not be verified',
        }),
      }),
    );
    expect(tx.driver.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { companyId: null, status: 'offline' },
    });
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'driver-user-1',
          data: { driverId: 'driver-1', status: 'REJECTED' },
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'reject',
          entityType: 'Driver',
          entityId: 'driver-1',
        }),
      }),
    );
  });

  it('records the initial 500 SYP cash subscription and activates an approved draft business', async () => {
    const business = {
      id: 'business-1',
      ownerId: 'owner-1',
      type: 'delivery_company',
      status: 'DRAFT',
      verificationStatus: 'APPROVED',
      subscriptionSuspendedAt: null,
      owner: { locale: 'ar' },
    };
    const tx = {
      business: {
        findUnique: vi.fn().mockResolvedValue(business),
        update: vi.fn().mockResolvedValue(undefined),
      },
      businessSubscription: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({ id: 'subscription-1' }),
      },
      invoice: { create: vi.fn().mockResolvedValue({ id: 'invoice-1' }) },
      payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1' }) },
      paymentLog: { create: vi.fn().mockResolvedValue(undefined) },
      notification: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
      deliveryCompany: { upsert: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await service.confirmCashSubscription('business-1', 'admin-1', 'Cash receipt 17');

    const subscriptionInput = tx.businessSubscription.create.mock.calls[0]?.[0];
    const paymentInput = tx.payment.create.mock.calls[0]?.[0];
    expect(subscriptionInput?.data).toMatchObject({
      businessId: 'business-1',
      plan: 'delivery_company_monthly',
      status: 'active',
      amountMinor: 500,
      currency: 'SYP',
      autoRenew: false,
    });
    expect(
      subscriptionInput?.data.periodEnd.getTime() - subscriptionInput?.data.periodStart.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);
    expect(tx.deliveryCompany.upsert).toHaveBeenCalledWith({
      where: { businessId: 'business-1' },
      create: { businessId: 'business-1', isOperational: true },
      update: { isOperational: true },
    });
    expect(paymentInput?.data).toMatchObject({
      method: 'cash_subscription',
      status: 'succeeded',
      amountMinor: 500,
      gateway: 'cash',
      userId: 'owner-1',
    });
    expect(tx.invoice.create.mock.calls[0]?.[0].data).toMatchObject({ status: 'paid' });
    expect(tx.paymentLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'cash_subscription_received',
          data: { receivedByAdminId: 'admin-1', note: 'Cash receipt 17' },
        }),
      }),
    );
    expect(tx.business.update).toHaveBeenCalledWith({
      where: { id: 'business-1' },
      data: { status: 'ACTIVE', subscriptionSuspendedAt: null },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('approves the application and linked business role atomically', async () => {
    const tx = {
      business: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'business-1',
          name: 'Restaurant',
          ownerId: 'owner-1',
          type: 'restaurant',
          verificationStatus: 'PENDING',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      userRoleAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      notification: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await service.approveBusiness('business-1', 'admin-1');

    expect(tx.business.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'business-1',
          verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] },
        }),
        data: expect.objectContaining({ verificationStatus: 'APPROVED' }),
      }),
    );
    expect(tx.userRoleAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'owner-1', role: 'restaurant' }),
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedById: 'admin-1',
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'business',
          dedupeKey: 'business-approved:business-1',
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('does not record cash or activate a business before approval', async () => {
    const tx = {
      business: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'business-1',
          ownerId: 'owner-1',
          type: 'merchant',
          status: 'DRAFT',
          verificationStatus: 'PENDING',
          subscriptionSuspendedAt: null,
          owner: { locale: 'ar' },
        }),
      },
      businessSubscription: { findFirst: vi.fn(), create: vi.fn() },
      invoice: { create: vi.fn() },
      payment: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new AdminService(prisma);

    await expect(service.confirmCashSubscription('business-1', 'admin-1')).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
    expect(tx.businessSubscription.create).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
