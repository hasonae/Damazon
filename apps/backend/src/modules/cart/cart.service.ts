import { Inject, Injectable } from '@nestjs/common';

import {
  BusinessRuleViolationError,
  OutOfStockError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import { visibleProductFilter } from '../catalog/catalog.mapper.js';
import {
  cartInclude,
  cartProductSelect,
  evaluate,
  variantRowSelect,
  type VariantRow,
} from './cart.shared.js';
import type {
  AddCartItemRequest,
  CartResponse,
  CartItemView,
  UpdateCartItemRequest,
} from './dto/cart.dto.js';

@Injectable()
export class CartService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    if (cart === null) {
      return { id: '', itemCount: 0, subtotalMinor: '0', currency: 'SYP', items: [] };
    }

    const variantIds = cart.items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== null);
    const variants = await this.loadVariants(variantIds);
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    let subtotal = 0;
    let itemCount = 0;
    const items: CartItemView[] = [];

    for (const item of cart.items) {
      const variant = item.variantId === null ? null : (variantsById.get(item.variantId) ?? null);
      const evaluation = evaluate(item.product, variant);
      const lineTotal = evaluation.unitPriceMinor * item.quantity;
      subtotal += lineTotal;
      itemCount += item.quantity;
      items.push({
        id: item.id,
        quantity: item.quantity,
        unitPriceMinor: String(evaluation.unitPriceMinor),
        lineTotalMinor: String(lineTotal),
        isPurchasable: evaluation.isPurchasable,
        stockQuantity: evaluation.stockQuantity,
        variant:
          variant === null
            ? null
            : { id: variant.id, nameAr: variant.nameAr, nameEn: variant.nameEn },
        product: {
          id: item.product.id,
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn,
          sku: item.product.sku,
          imageUrl: item.product.images[0]?.imageUrl ?? null,
          currency: item.product.currency,
          businessId: item.product.business.id,
          businessName: item.product.business.name,
        },
      });
    }

    return {
      id: cart.id,
      itemCount,
      subtotalMinor: String(subtotal),
      currency: items[0]?.product.currency ?? 'SYP',
      items,
    };
  }

  public async addItem(userId: string, payload: AddCartItemRequest): Promise<CartResponse> {
    const product = await this.prisma.product.findFirst({
      where: { id: payload.productId, ...visibleProductFilter() },
      select: cartProductSelect,
    });
    if (product === null) {
      throw new ResourceNotFoundError('Product', payload.productId);
    }
    if (!product.isAvailable) {
      throw new BusinessRuleViolationError('This product is currently unavailable');
    }

    const variant = await this.loadVariant(payload.variantId, product.id);
    if (payload.variantId !== undefined && variant === null) {
      throw new ResourceNotFoundError('Product variant', payload.variantId);
    }
    if (variant !== null && !variant.isAvailable) {
      throw new BusinessRuleViolationError('This variant is currently unavailable');
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: product.id, variantId: variant?.id ?? null },
    });

    const evaluation = evaluate(product, variant);
    const nextQuantity = (existing?.quantity ?? 0) + payload.quantity;
    if (product.trackInventory && nextQuantity > evaluation.stockQuantity) {
      throw new OutOfStockError(product.nameAr, payload.quantity, evaluation.stockQuantity);
    }

    if (existing === null) {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity: nextQuantity,
          unitPriceMinor: evaluation.unitPriceMinor,
        },
      });
    } else {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity, unitPriceMinor: evaluation.unitPriceMinor },
      });
    }

    return this.getCart(userId);
  }

  public async updateItem(
    userId: string,
    itemId: string,
    payload: UpdateCartItemRequest,
  ): Promise<CartResponse> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: { select: cartProductSelect } },
    });
    if (item === null) {
      throw new ResourceNotFoundError('Cart item', itemId);
    }

    const variant = await this.loadVariant(item.variantId ?? undefined, item.productId);
    const evaluation = evaluate(item.product, variant);
    if (item.product.trackInventory && payload.quantity > evaluation.stockQuantity) {
      throw new OutOfStockError(item.product.nameAr, payload.quantity, evaluation.stockQuantity);
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: payload.quantity, unitPriceMinor: evaluation.unitPriceMinor },
    });

    return this.getCart(userId);
  }

  public async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const result = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundError('Cart item', itemId);
    }
    return this.getCart(userId);
  }

  public async clearCart(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  private async loadVariant(
    variantId: string | undefined,
    productId: string,
  ): Promise<VariantRow | null> {
    if (variantId === undefined) {
      return null;
    }
    return this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: variantRowSelect,
    });
  }

  private async loadVariants(variantIds: readonly string[]): Promise<readonly VariantRow[]> {
    if (variantIds.length === 0) {
      return [];
    }
    return this.prisma.productVariant.findMany({
      where: { id: { in: [...variantIds] } },
      select: variantRowSelect,
    });
  }
}
