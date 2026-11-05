import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../src/database/prisma.service.js';
import { SubscriptionLifecycleService } from '../src/modules/admin/subscription-lifecycle.service.js';

describe('SubscriptionLifecycleService', () => {
  it('sends one deduplicated reminder for subscriptions expiring within six days', async () => {
    const now = new Date();
    const subscription = {
      id: 'subscription-1',
      businessId: 'business-1',
      periodEnd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      business: { id: 'business-1', ownerId: 'owner-1' },
    };
    const prisma = {
      businessSubscription: {
        findMany: vi.fn().mockResolvedValueOnce([subscription]).mockResolvedValueOnce([]),
        updateMany: vi.fn(),
        findFirst: vi.fn(),
      },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const service = new SubscriptionLifecycleService(prisma);

    await service.runOnce();

    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            userId: 'owner-1',
            type: 'subscription',
            dedupeKey: 'subscription-reminder:subscription-1',
            data: expect.objectContaining({ daysUntilExpiry: 5 }),
          }),
        ],
      }),
    );
  });

  it('expires past periods, promotes a paid pending period, and suspends only when no active period remains', async () => {
    const tx = {
      businessSubscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      business: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'business-1',
          name: 'Store',
          status: 'ACTIVE',
          verificationStatus: 'APPROVED',
          subscriptionSuspendedAt: null,
          ownerId: 'owner-1',
          owner: { locale: 'ar' },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      notification: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      businessSubscription: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ businessId: 'business-1' }]),
      },
      notification: { createMany: vi.fn() },
      $transaction: vi.fn((operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    } as unknown as PrismaService;
    const service = new SubscriptionLifecycleService(prisma);

    await service.runOnce();

    expect(tx.businessSubscription.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active', periodEnd: expect.any(Object) }),
        data: { status: 'expired' },
      }),
    );
    expect(tx.businessSubscription.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: 'pending' }),
        data: { status: 'active' },
      }),
    );
    expect(tx.business.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE', subscriptionSuspendedAt: null }),
        data: expect.objectContaining({ status: 'SUSPENDED' }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: expect.stringMatching(/^subscription-expired:/),
        }),
      }),
    );
  });
});
