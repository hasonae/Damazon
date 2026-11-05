import { Inject, Injectable } from '@nestjs/common';
import type { Business, Prisma } from '@prisma/client';
import { parseSyrianPhone } from '@damazon/utilities';
import type { AuthPrincipal } from '../../security/token.service.js';

import {
  BusinessRuleViolationError,
  ConflictError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  businessDetailSelect,
  businessListSelect,
  toBusinessDetail,
  toBusinessRole,
  toBusinessSummary,
} from './businesses.mapper.js';
import type {
  BusinessProductView,
  BusinessDetail,
  BusinessNotification,
  BusinessSummary,
  CreateBusinessProductRequest,
  RegisterBusinessRequest,
  UpdateBusinessProductRequest,
  UpdateBusinessRequest,
} from './dto/businesses.dto.js';

/**
 * Business tenancy: registration, owned-business listing, and owner updates.
 *
 * Approval and suspension are intentionally absent here — they belong to the
 * administrative review flow, because a business that approves itself is not
 * verified.
 */
@Injectable()
export class BusinessesService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listMine(userId: string): Promise<readonly BusinessSummary[]> {
    const rows = await this.prisma.business.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: businessListSelect,
    });
    return rows.map((row) => toBusinessSummary(row));
  }

  public async listSubscriptionNotifications(
    userId: string,
  ): Promise<readonly BusinessNotification[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    if (user === null) {
      throw new ResourceNotFoundError('User', userId);
    }
    const rows = await this.prisma.notification.findMany({
      where: { userId, type: { in: ['business', 'subscription'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      title: user.locale === 'ar' ? row.titleAr : row.titleEn,
      body: user.locale === 'ar' ? row.bodyAr : row.bodyEn,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  public async getBusiness(viewerId: string, businessId: string): Promise<BusinessDetail> {
    const row = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: businessDetailSelect,
    });
    if (row === null) {
      throw new ResourceNotFoundError('Business', businessId);
    }
    if (row.ownerId !== viewerId) {
      assertVisibleToPublic(row);
    }
    return toBusinessDetail(row, viewerId);
  }

  public async registerBusiness(
    userId: string,
    payload: RegisterBusinessRequest,
  ): Promise<BusinessDetail> {
    const businessRole = toBusinessRole(payload.type);
    const phone = parseSyrianPhone(payload.phone);
    if (phone === null) {
      throw new BusinessRuleViolationError('A valid Syrian mobile number is required');
    }
    const existing = await this.prisma.business.findMany({
      where: { ownerId: userId, type: payload.type },
      select: { id: true, status: true, verificationStatus: true },
    });
    const blocking = existing.find(
      (row) => row.verificationStatus !== 'REJECTED' && row.status !== 'CLOSED',
    );
    if (blocking !== undefined) {
      throw new ConflictError(`You already have a ${payload.type} business under review or active`);
    }

    if (payload.cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: payload.cityId },
        select: { id: true },
      });
      if (city === null) {
        throw new ResourceNotFoundError('City', payload.cityId);
      }
    }

    const created = await this.prisma.$transaction(async (client) => {
      const business = await client.business.create({
        data: {
          ownerId: userId,
          type: payload.type,
          name: payload.name,
          description: payload.description ?? null,
          phone: phone.e164,
          email: payload.email ?? null,
          logoUrl: payload.logoUrl ?? null,
          coverImageUrl: payload.coverImageUrl ?? null,
          cityId: payload.cityId ?? null,
          addressLine: payload.addressLine ?? null,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          status: 'DRAFT',
          verificationStatus: 'PENDING',
          ...(payload.type === 'restaurant' ? { restaurantProfile: { create: {} } } : {}),
          ...(payload.type === 'delivery_company' ? { deliveryCompany: { create: {} } } : {}),
        },
        select: { id: true },
      });

      await client.userRoleAssignment.upsert({
        where: { userId_role: { userId, role: businessRole } },
        create: { userId, role: businessRole, status: 'PENDING', activeBusinessId: business.id },
        update: { status: 'PENDING', activeBusinessId: business.id },
      });

      return client.business.findUniqueOrThrow({
        where: { id: business.id },
        select: businessDetailSelect,
      });
    });

    return toBusinessDetail(created, userId);
  }

  public async updateBusiness(
    userId: string,
    businessId: string,
    payload: UpdateBusinessRequest,
  ): Promise<BusinessDetail> {
    const existing = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
      select: { id: true, status: true },
    });
    if (existing === null) {
      throw new ResourceNotFoundError('Business', businessId);
    }
    if (existing.status === 'CLOSED') {
      throw new BusinessRuleViolationError('A closed business cannot be edited');
    }

    if (payload.cityId !== undefined && payload.cityId !== null) {
      const city = await this.prisma.city.findUnique({
        where: { id: payload.cityId },
        select: { id: true },
      });
      if (city === null) {
        throw new ResourceNotFoundError('City', payload.cityId);
      }
    }

    const phone = payload.phone === undefined ? undefined : parseSyrianPhone(payload.phone);
    if (payload.phone !== undefined && phone === null) {
      throw new BusinessRuleViolationError('A valid Syrian mobile number is required');
    }
    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(phone === undefined || phone === null ? {} : { phone: phone.e164 }),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
        ...(payload.coverImageUrl !== undefined ? { coverImageUrl: payload.coverImageUrl } : {}),
        ...(payload.cityId !== undefined ? { cityId: payload.cityId } : {}),
        ...(payload.addressLine !== undefined ? { addressLine: payload.addressLine } : {}),
        ...(payload.latitude !== undefined ? { latitude: payload.latitude } : {}),
        ...(payload.longitude !== undefined ? { longitude: payload.longitude } : {}),
      },
      select: businessDetailSelect,
    });
    return toBusinessDetail(updated, userId);
  }

  public async listProducts(
    principal: AuthPrincipal,
    businessId: string,
  ): Promise<readonly BusinessProductView[]> {
    await this.requireBusinessAccess(principal, businessId);
    const products = await this.prisma.product.findMany({
      where: { businessId },
      include: { images: { orderBy: { orderIndex: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return products.map(toBusinessProductView);
  }

  public async createProduct(
    principal: AuthPrincipal,
    businessId: string,
    payload: CreateBusinessProductRequest,
  ): Promise<BusinessProductView> {
    const business = await this.requireBusinessAccess(principal, businessId);
    if (payload.status === 'active') {
      assertBusinessCanPublish(business);
      if (payload.stockQuantity === 0) {
        throw new BusinessRuleViolationError(
          'A product must have stock before it can be published',
        );
      }
    }
    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      await this.requireCategory(payload.categoryId);
    }

    const product = await this.prisma.product.create({
      data: {
        businessId,
        sku: payload.sku,
        nameAr: payload.nameAr,
        nameEn: payload.nameEn,
        description: payload.description ?? null,
        priceMinor: payload.priceMinor,
        categoryId: payload.categoryId ?? null,
        stockQuantity: payload.stockQuantity,
        isAvailable: payload.isAvailable,
        status: payload.status,
        images: {
          create: payload.imageUrls.map((imageUrl, orderIndex) => ({ imageUrl, orderIndex })),
        },
      },
      include: { images: { orderBy: { orderIndex: 'asc' } } },
    });
    return toBusinessProductView(product);
  }

  public async updateProduct(
    principal: AuthPrincipal,
    businessId: string,
    productId: string,
    payload: UpdateBusinessProductRequest,
  ): Promise<BusinessProductView> {
    const business = await this.requireBusinessAccess(principal, businessId);
    if (payload.status === 'active') {
      assertBusinessCanPublish(business);
    }
    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      await this.requireCategory(payload.categoryId);
    }
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { id: true, stockQuantity: true },
    });
    if (existing === null) {
      throw new ResourceNotFoundError('Product', productId);
    }
    if (payload.status === 'active' && (payload.stockQuantity ?? existing.stockQuantity) === 0) {
      throw new BusinessRuleViolationError('A product must have stock before it can be published');
    }

    const product = await this.prisma.$transaction(async (client) => {
      if (payload.imageUrls !== undefined) {
        await client.productImage.deleteMany({ where: { productId } });
      }
      return client.product.update({
        where: { id: productId },
        data: {
          ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
          ...(payload.nameAr !== undefined ? { nameAr: payload.nameAr } : {}),
          ...(payload.nameEn !== undefined ? { nameEn: payload.nameEn } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.priceMinor !== undefined ? { priceMinor: payload.priceMinor } : {}),
          ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
          ...(payload.stockQuantity !== undefined
            ? {
                stockQuantity: payload.stockQuantity,
                ...(payload.stockQuantity === 0 ? { status: 'out_of_stock' as const } : {}),
              }
            : {}),
          ...(payload.isAvailable !== undefined ? { isAvailable: payload.isAvailable } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(payload.imageUrls !== undefined
            ? {
                images: {
                  create: payload.imageUrls.map((imageUrl, orderIndex) => ({
                    imageUrl,
                    orderIndex,
                  })),
                },
              }
            : {}),
        },
        include: { images: { orderBy: { orderIndex: 'asc' } } },
      });
    });
    return toBusinessProductView(product);
  }

  private async requireBusinessAccess(
    principal: AuthPrincipal,
    businessId: string,
  ): Promise<{
    readonly id: string;
    readonly ownerId: string;
    readonly status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    readonly verificationStatus:
      'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'BLOCKED';
    readonly subscriptions: readonly {
      readonly status: string;
      readonly periodStart: Date;
      readonly periodEnd: Date;
    }[];
  }> {
    if (principal.activeBusinessId !== businessId) {
      throw new ResourceNotFoundError('Business', businessId);
    }
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: principal.userId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        verificationStatus: true,
        subscriptions: {
          where: { status: 'active' },
          select: { status: true, periodStart: true, periodEnd: true },
        },
      },
    });
    if (business === null) {
      throw new ResourceNotFoundError('Business', businessId);
    }
    return business;
  }

  private async requireCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (category === null || !category.isActive) {
      throw new ResourceNotFoundError('Category', categoryId);
    }
  }
}

function assertBusinessCanPublish(business: {
  readonly status: string;
  readonly verificationStatus: string;
  readonly subscriptions: readonly {
    readonly status: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }[];
}): void {
  const now = new Date();
  const hasActiveSubscription = business.subscriptions.some(
    (subscription) =>
      subscription.status === 'active' &&
      subscription.periodStart <= now &&
      subscription.periodEnd > now,
  );
  if (
    business.status !== 'ACTIVE' ||
    business.verificationStatus !== 'APPROVED' ||
    !hasActiveSubscription
  ) {
    throw new BusinessRuleViolationError(
      'Only approved businesses with an active subscription can publish products',
    );
  }
}

function toBusinessProductView(
  product: Prisma.ProductGetPayload<{
    include: { images: { orderBy: { orderIndex: 'asc' } } };
  }>,
): BusinessProductView {
  return {
    id: product.id,
    sku: product.sku,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    description: product.description,
    priceMinor: String(product.priceMinor),
    currency: product.currency,
    stockQuantity: product.stockQuantity,
    isAvailable: product.isAvailable,
    status: product.status,
    categoryId: product.categoryId,
    imageUrls: product.images.map((image) => image.imageUrl),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function assertVisibleToPublic(row: Pick<Business, 'status' | 'verificationStatus'>): void {
  if (row.status !== 'ACTIVE' || row.verificationStatus !== 'APPROVED') {
    throw new ResourceNotFoundError('Business');
  }
}

export type { BusinessDetail, BusinessSummary, RegisterBusinessRequest, UpdateBusinessRequest };
