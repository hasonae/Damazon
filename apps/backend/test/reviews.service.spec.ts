import { describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@damazon/shared-types';

import {
  BusinessRuleViolationError,
  ConflictError,
  ResourceNotFoundError,
} from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { ReviewsService } from '../src/modules/reviews/reviews.service.js';
import type { AuthPrincipal } from '../src/security/token.service.js';

type ReviewRow = {
  id: string;
  userId: string;
  orderId: string | null;
  productId: string | null;
  targetType: 'product' | 'business' | 'driver';
  targetId: string;
  rating: number;
  comment: string | null;
  status: 'pending' | 'published' | 'rejected' | 'flagged';
  createdAt: Date;
  updatedAt: Date;
  user: { firstName: string; lastName: string };
};

function makeReviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  const now = new Date('2026-01-05T10:00:00.000Z');
  return {
    id: 'review-1',
    userId: 'customer-1',
    orderId: 'order-1',
    productId: 'product-1',
    targetType: 'product',
    targetId: 'product-1',
    rating: 5,
    comment: 'Solid',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    user: { firstName: 'Sara', lastName: 'Nasser' },
    ...overrides,
  };
}

function principal(role: UserRole): AuthPrincipal {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    activeRole: role,
    activeBusinessId: null,
    roles: [role],
    adminDepartments: [],
  };
}

function createPrismaFake() {
  const client = {
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'product-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    business: {
      findUnique: vi.fn().mockResolvedValue({ id: 'business-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    driver: {
      findUnique: vi.fn().mockResolvedValue({ id: 'driver-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    order: { findFirst: vi.fn().mockResolvedValue({ id: 'order-1' }) },
    review: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(makeReviewRow()),
      update: vi.fn().mockResolvedValue(makeReviewRow({ status: 'published' })),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { _all: 2 },
      }),
    },
  };

  const prisma = {
    ...client,
    transaction: vi.fn(async (operation: (tx: typeof client) => Promise<unknown>) =>
      operation(client),
    ),
  };

  return { client, prisma: prisma as unknown as PrismaService };
}

describe('ReviewsService.create', () => {
  it('stores a verified product review and recomputes the rating aggregate', async () => {
    const { client, prisma } = createPrismaFake();
    const service = new ReviewsService(prisma);
    // The row the database returns mirrors what was written.
    client.review.create.mockResolvedValue(makeReviewRow({ rating: 4 }));

    const view = await service.create('customer-1', {
      targetType: 'product',
      targetId: 'product-1',
      rating: 4,
      comment: 'Exactly as described',
    });

    expect(client.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'customer-1',
          items: { some: { productId: 'product-1' } },
        }),
      }),
    );
    expect(client.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          orderId: 'order-1',
          productId: 'product-1',
          rating: 4,
        }),
      }),
    );
    expect(client.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { ratingAverage: 4.5, ratingCount: 2 },
    });
    expect(view).toMatchObject({
      status: 'pending',
      verifiedPurchase: true,
      rating: 4,
      author: { id: 'customer-1', displayName: 'Sara Nasser' },
    });
  });

  it('refuses a target that does not exist', async () => {
    const { client, prisma } = createPrismaFake();
    client.product.findUnique.mockResolvedValue(null);
    const service = new ReviewsService(prisma);

    await expect(
      service.create('customer-1', { targetType: 'product', targetId: 'missing', rating: 5 }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(client.review.create).not.toHaveBeenCalled();
  });

  it('refuses a customer without a completed order for the target', async () => {
    const { client, prisma } = createPrismaFake();
    client.order.findFirst.mockResolvedValue(null);
    const service = new ReviewsService(prisma);

    await expect(
      service.create('customer-1', { targetType: 'product', targetId: 'product-1', rating: 5 }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    expect(client.review.create).not.toHaveBeenCalled();
  });

  it('refuses a second review from the same customer for the same target', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findFirst.mockResolvedValue({ id: 'existing' });
    const service = new ReviewsService(prisma);

    await expect(
      service.create('customer-1', { targetType: 'product', targetId: 'product-1', rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('proves a driver review through the delivery task of the order', async () => {
    const { client, prisma } = createPrismaFake();
    const service = new ReviewsService(prisma);

    await service.create('customer-1', { targetType: 'driver', targetId: 'driver-9', rating: 5 });

    expect(client.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryTask: { is: { driverId: 'driver-9' } } }),
      }),
    );
    expect(client.driver.update).toHaveBeenCalledWith({
      where: { id: 'driver-9' },
      data: { ratingAverage: 4.5, ratingCount: 2 },
    });
    expect(client.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: null }) }),
    );
  });
});

describe('ReviewsService.moderate', () => {
  it('publishes a review and refreshes the target aggregate', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findUnique.mockResolvedValue(makeReviewRow());
    client.review.update.mockResolvedValue(makeReviewRow({ status: 'published' }));
    const service = new ReviewsService(prisma);

    const view = await service.moderate('review-1', { status: 'published' });

    expect(client.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'published' } }),
    );
    expect(client.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'published' }) }),
    );
    expect(client.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { ratingAverage: 4.5, ratingCount: 2 },
    });
    expect(view.status).toBe('published');
  });

  it('reports an unknown review as not found', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findUnique.mockResolvedValue(null);
    const service = new ReviewsService(prisma);

    await expect(service.moderate('missing', { status: 'rejected' })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(client.review.update).not.toHaveBeenCalled();
  });
});

describe('ReviewsService.list', () => {
  it('never shows drafts to a reader without the moderation permission', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findMany.mockResolvedValue([makeReviewRow({ status: 'published' })]);
    client.review.count.mockResolvedValue(1);
    const service = new ReviewsService(prisma);

    const page = await service.list(principal('customer'), {
      targetType: 'product',
      status: 'pending',
      limit: 20,
    });

    expect(client.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetType: 'product', status: 'published' }),
      }),
    );
    expect(page.items[0]?.status).toBe('published');
    expect(page.meta.totalCount).toBe(1);
  });

  it('honours the status filter for a moderator', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findMany.mockResolvedValue([makeReviewRow({ status: 'pending' })]);
    const service = new ReviewsService(prisma);

    await service.list(principal('merchant'), { status: 'pending', limit: 20 });

    expect(client.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
    );
  });

  it('walks the keyset cursor and reports the next page', async () => {
    const { client, prisma } = createPrismaFake();
    client.review.findMany.mockResolvedValue([
      makeReviewRow({ id: 'a', createdAt: new Date('2026-01-05T10:00:00.000Z') }),
      makeReviewRow({ id: 'b', createdAt: new Date('2026-01-04T10:00:00.000Z') }),
    ]);
    client.review.count.mockResolvedValue(2);
    const service = new ReviewsService(prisma);

    const page = await service.list(principal('customer'), { limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.meta.hasMore).toBe(true);
    expect(page.meta.nextCursor).toEqual(expect.any(String));
    expect(page.meta.totalCount).toBe(2);
  });
});
