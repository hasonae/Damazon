import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, ReviewStatus, ReviewTargetType } from '@prisma/client';
import {
  ADMIN_DEPARTMENT_PERMISSIONS,
  buildPage,
  decodeCursor,
  encodeCursor,
  ORDER_SUCCESS_STATUSES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type PaginatedResult,
  type Permission,
} from '@damazon/shared-types';

import {
  BusinessRuleViolationError,
  ConflictError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService, type PrismaTransactionClient } from '../../database/prisma.service.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import type {
  CreateReviewRequest,
  ListReviewsQuery,
  ModerateReviewRequest,
  ReviewView,
} from './dto/reviews.dto.js';

const reviewAuthorInclude = {
  user: { select: { firstName: true, lastName: true } },
} as const;

interface ReviewRow {
  readonly id: string;
  readonly userId: string;
  readonly orderId: string | null;
  readonly productId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly status: ReviewStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly user: { readonly firstName: string; readonly lastName: string };
}

/**
 * Mirrors how `PermissionsGuard` resolves the granted set, so the list route
 * can honour the moderation visibility rule without re-describing the matrix.
 */
function grantedPermissions(principal: AuthPrincipal): readonly Permission[] {
  if (principal.activeRole !== 'admin') {
    return ROLE_PERMISSIONS[principal.activeRole];
  }
  const granted = new Set<Permission>();
  for (const department of principal.adminDepartments) {
    for (const permission of ADMIN_DEPARTMENT_PERMISSIONS[department]) {
      granted.add(permission);
    }
  }
  return [...granted];
}

function toReviewView(row: ReviewRow): ReviewView {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    productId: row.productId,
    orderId: row.orderId,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    verifiedPurchase: row.orderId !== null,
    author: {
      id: row.userId,
      displayName: `${row.user.firstName} ${row.user.lastName}`.trim(),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ReviewsService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async create(userId: string, payload: CreateReviewRequest): Promise<ReviewView> {
    const { targetType, targetId, rating, comment } = payload;

    return this.prisma.transaction(async (client) => {
      await this.assertTargetExists(client, targetType, targetId);

      const order = await this.findVerifiedOrder(client, userId, targetType, targetId);
      if (order === null) {
        throw new BusinessRuleViolationError('Only completed orders may be reviewed');
      }

      const existing = await client.review.findFirst({
        where: { userId, targetType, targetId },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('This customer has already reviewed this target');
      }

      const created = await client.review.create({
        data: {
          userId,
          orderId: order.id,
          productId: targetType === 'product' ? targetId : null,
          targetType,
          targetId,
          rating,
          comment: comment ?? null,
          // Verified purchases still enter the moderation queue; only published
          // rows count toward the target's rating until a moderator decides.
          status: 'pending',
        },
        include: reviewAuthorInclude,
      });

      await this.recomputeRating(client, targetType, targetId);

      return toReviewView(created);
    });
  }

  public async list(
    principal: AuthPrincipal,
    query: ListReviewsQuery,
  ): Promise<PaginatedResult<ReviewView>> {
    const canModerate = grantedPermissions(principal).includes(PERMISSIONS.REVIEW_MODERATE);

    const where: Prisma.ReviewWhereInput = {};
    if (query.targetType !== undefined) {
      where.targetType = query.targetType;
    }
    if (query.targetId !== undefined) {
      where.targetId = query.targetId;
    }
    if (canModerate) {
      if (query.status !== undefined) {
        where.status = query.status;
      }
    } else {
      // Drafts are a moderation concern: a reader without the moderation
      // permission only ever sees published rows, whatever was requested.
      where.status = 'published';
    }

    const keysetWhere: Prisma.ReviewWhereInput = { ...where };
    if (query.cursor !== undefined) {
      try {
        const { createdAt, id } = decodeCursor(query.cursor);
        keysetWhere.AND = [
          { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] },
        ];
      } catch {
        // A malformed cursor restarts the list instead of failing the page.
      }
    }

    const rows = await this.prisma.review.findMany({
      where: keysetWhere,
      include: reviewAuthorInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const totalItems = await this.prisma.review.count({ where });
    const last = page[page.length - 1];

    return buildPage(
      page.map(toReviewView),
      query.limit,
      hasMore,
      hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
      totalItems,
    );
  }

  public async moderate(reviewId: string, payload: ModerateReviewRequest): Promise<ReviewView> {
    return this.prisma.transaction(async (client) => {
      const review = await client.review.findUnique({
        where: { id: reviewId },
        include: reviewAuthorInclude,
      });
      if (review === null) {
        throw new ResourceNotFoundError('Review', reviewId);
      }

      const updated = await client.review.update({
        where: { id: reviewId },
        data: { status: payload.status },
        include: reviewAuthorInclude,
      });

      // Publishing or hiding a row changes which rows count toward the
      // target's average, so the aggregate follows the moderation decision.
      await this.recomputeRating(client, updated.targetType, updated.targetId);

      return toReviewView(updated);
    });
  }

  private async assertTargetExists(
    client: PrismaTransactionClient,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case 'product': {
        const product = await client.product.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (product === null) {
          throw new ResourceNotFoundError('Product', targetId);
        }
        return;
      }
      case 'business': {
        const business = await client.business.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (business === null) {
          throw new ResourceNotFoundError('Business', targetId);
        }
        return;
      }
      case 'driver': {
        const driver = await client.driver.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
        if (driver === null) {
          throw new ResourceNotFoundError('Driver', targetId);
        }
        return;
      }
    }
  }

  /**
   * The verified-purchase proof: a completed order of this customer that
   * actually contains the target. Without it the review never exists.
   */
  private async findVerifiedOrder(
    client: PrismaTransactionClient,
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<{ readonly id: string } | null> {
    const where: Prisma.OrderWhereInput = {
      customerId: userId,
      status: { in: [...ORDER_SUCCESS_STATUSES] },
    };
    switch (targetType) {
      case 'product':
        where.items = { some: { productId: targetId } };
        break;
      case 'business':
        where.businessId = targetId;
        break;
      case 'driver':
        where.deliveryTask = { is: { driverId: targetId } };
        break;
    }

    return client.order.findFirst({
      where,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recomputeRating(
    client: PrismaTransactionClient,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<void> {
    const aggregate = await client.review.aggregate({
      where: { targetType, targetId, status: 'published' },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const ratingCount = aggregate._count._all;
    // The columns are DECIMAL(3,2), so the average is rounded to the same
    // precision the schema stores instead of carrying float noise.
    const ratingAverage = Math.round((aggregate._avg.rating ?? 0) * 100) / 100;

    switch (targetType) {
      case 'product':
        await client.product.update({
          where: { id: targetId },
          data: { ratingAverage, ratingCount },
        });
        return;
      case 'business':
        await client.business.update({
          where: { id: targetId },
          data: { ratingAverage, ratingCount },
        });
        return;
      case 'driver':
        await client.driver.update({
          where: { id: targetId },
          data: { ratingAverage, ratingCount },
        });
        return;
    }
  }
}
