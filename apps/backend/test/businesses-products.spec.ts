import { describe, expect, it, vi } from 'vitest';

import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
} from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { BusinessesService } from '../src/modules/businesses/businesses.service.js';
import { createBusinessProductSchema } from '../src/modules/businesses/dto/businesses.dto.js';

const principal = {
  userId: 'owner-1',
  sessionId: 'session-1',
  activeRole: 'merchant' as const,
  activeBusinessId: 'business-1',
  roles: ['merchant' as const],
  adminDepartments: [],
};

function createBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: 'business-1',
    ownerId: 'owner-1',
    status: 'ACTIVE',
    verificationStatus: 'APPROVED',
    subscriptions: [
      {
        status: 'active',
        periodStart: new Date(Date.now() - 60_000),
        periodEnd: new Date(Date.now() + 60_000),
      },
    ],
    ...overrides,
  };
}

function createPrismaFake(business = createBusiness()) {
  const prisma = {
    business: { findFirst: vi.fn().mockResolvedValue(business) },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'product-1',
        sku: 'sku-1',
        nameAr: 'منتج',
        nameEn: 'Product',
        description: null,
        priceMinor: 1250,
        currency: 'SYP',
        stockQuantity: 4,
        isAvailable: true,
        status: 'draft',
        categoryId: null,
        images: [{ imageUrl: 'https://example.com/image.jpg' }],
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    },
  };
  return { service: new BusinessesService(prisma as unknown as PrismaService), raw: prisma };
}

describe('business product publishing', () => {
  it('requires an image and a valid price in product creation input', () => {
    expect(
      createBusinessProductSchema.safeParse({
        sku: 'sku-1',
        nameAr: 'منتج',
        nameEn: 'Product',
        priceMinor: 0,
        imageUrls: [],
      }).success,
    ).toBe(false);
  });

  it('restricts product access to the selected business owned by the principal', async () => {
    const { service, raw } = createPrismaFake();

    await expect(
      service.listProducts({ ...principal, activeBusinessId: 'another-business' }, 'business-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(raw.business.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to publish until the business has an active subscription', async () => {
    const { service, raw } = createPrismaFake({ ...createBusiness(), subscriptions: [] });

    await expect(
      service.createProduct(principal, 'business-1', {
        sku: 'sku-1',
        nameAr: 'منتج',
        nameEn: 'Product',
        priceMinor: 1250,
        stockQuantity: 4,
        isAvailable: true,
        status: 'active',
        imageUrls: ['https://example.com/image.jpg'],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    expect(raw.product.create).not.toHaveBeenCalled();
  });

  it('creates a draft product and maps its image for the merchant', async () => {
    const { service, raw } = createPrismaFake();

    const product = await service.createProduct(principal, 'business-1', {
      sku: 'sku-1',
      nameAr: 'منتج',
      nameEn: 'Product',
      priceMinor: 1250,
      stockQuantity: 4,
      isAvailable: true,
      status: 'draft',
      imageUrls: ['https://example.com/image.jpg'],
    });

    expect(raw.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'business-1',
          sku: 'sku-1',
          priceMinor: 1250,
          status: 'draft',
          images: { create: [{ imageUrl: 'https://example.com/image.jpg', orderIndex: 0 }] },
        }),
      }),
    );
    expect(product).toMatchObject({
      id: 'product-1',
      priceMinor: '1250',
      imageUrls: ['https://example.com/image.jpg'],
    });
  });
});
