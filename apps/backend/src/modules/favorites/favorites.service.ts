import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  productSummaryInclude,
  toProductSummary,
  visibleProductFilter,
} from '../catalog/catalog.mapper.js';
import type { ProductSummary } from '../catalog/dto/catalog.dto.js';

@Injectable()
export class FavoritesService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listProducts(userId: string): Promise<readonly ProductSummary[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, targetType: 'product', productId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { include: productSummaryInclude },
      },
    });

    return (
      favorites
        .map((favorite) => favorite.product)
        // A product the merchant removed or a business that stopped trading
        // since it was saved disappears from the list rather than rendering a
        // broken card or a card that can no longer be opened.
        .filter((product): product is NonNullable<typeof product> => product !== null)
        .filter(
          (product) =>
            product.status === 'active' &&
            product.business.status === 'ACTIVE' &&
            product.business.verificationStatus === 'APPROVED',
        )
        .map(toProductSummary)
    );
  }

  public async addProduct(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...visibleProductFilter() },
      select: { id: true },
    });
    if (product === null) {
      throw new ResourceNotFoundError('Product', productId);
    }

    const existing = await this.prisma.favorite.findFirst({
      where: { userId, targetType: 'product', productId },
      select: { id: true },
    });
    if (existing !== null) {
      return;
    }

    try {
      await this.prisma.favorite.create({
        data: { userId, targetType: 'product', productId },
      });
    } catch {
      // Two rapid taps race on the unique (user, type, product) constraint;
      // the second insert losing is the desired end state, not an error.
    }
  }

  public async removeProduct(userId: string, productId: string): Promise<void> {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId, targetType: 'product', productId },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundError('Favorite', productId);
    }
  }
}
