import { describe, expect, it, vi } from 'vitest';

import { BusinessRuleViolationError } from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { AdvertisementsService } from '../src/modules/advertisements/advertisements.service.js';

const principal = {
  userId: 'admin-1',
  sessionId: 'session-1',
  activeRole: 'admin' as const,
  activeBusinessId: null,
  roles: ['admin' as const],
  adminDepartments: ['marketing' as const],
};

const advertisementRow = {
  id: 'ad-1',
  title: 'Promotion',
  caption: 'Featured offer',
  imageUrl: 'https://example.com/banner.jpg',
  targetUrl: 'https://example.com/offer',
  status: 'active' as const,
  startsAt: new Date('2026-01-01T00:00:00.000Z'),
  endsAt: null,
  position: 0,
  createdById: 'admin-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createPrismaFake() {
  const tx = {
    advertisement: {
      create: vi.fn().mockResolvedValue(advertisementRow),
      update: vi.fn().mockResolvedValue(advertisementRow),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    advertisement: {
      findMany: vi.fn().mockResolvedValue([advertisementRow]),
      findUnique: vi.fn().mockResolvedValue(advertisementRow),
    },
    $transaction: vi.fn((operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return {
    service: new AdvertisementsService(prisma as unknown as PrismaService),
    raw: prisma,
    tx,
  };
}

describe('AdvertisementsService', () => {
  it('only returns active advertisements inside their schedule', async () => {
    const { service, raw } = createPrismaFake();

    const result = await service.listActive();

    expect(raw.advertisement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          startsAt: { lte: expect.any(Date) },
          OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }],
        }),
        take: 20,
      }),
    );
    expect(result[0]).toMatchObject({
      id: 'ad-1',
      title: 'Promotion',
      imageUrl: 'https://example.com/banner.jpg',
    });
  });

  it('records the administrator and audit event when creating a campaign', async () => {
    const { service, tx } = createPrismaFake();

    const result = await service.create(principal, {
      title: 'Promotion',
      caption: 'Featured offer',
      imageUrl: 'https://example.com/banner.jpg',
      targetUrl: 'https://example.com/offer',
      status: 'active',
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      position: 0,
    });

    expect(tx.advertisement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: 'admin-1', status: 'active' }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'create',
          entityType: 'advertisement',
          entityId: 'ad-1',
        }),
      }),
    );
    expect(result.id).toBe('ad-1');
  });

  it('rejects schedules where the end precedes the start', async () => {
    const { service, tx } = createPrismaFake();

    await expect(
      service.create(principal, {
        title: 'Promotion',
        imageUrl: 'https://example.com/banner.jpg',
        status: 'active',
        startsAt: new Date('2026-01-02T00:00:00.000Z'),
        endsAt: new Date('2026-01-01T00:00:00.000Z'),
        position: 0,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    expect(tx.advertisement.create).not.toHaveBeenCalled();
  });
});
