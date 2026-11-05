/**
 * Cart row shapes and pricing rules shared by the cart and orders modules.
 *
 * Checkout must re-validate every line through the exact same rules the cart
 * displayed, otherwise the price a customer sees and the price they pay can
 * diverge. Keeping one definition here is what guarantees they cannot
 * (Rule 9: never duplicate business logic).
 */

import type { Prisma } from '@prisma/client';

import { salePriceMinor } from '../catalog/catalog.mapper.js';

export const cartProductSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  sku: true,
  priceMinor: true,
  discountPercent: true,
  currency: true,
  stockQuantity: true,
  trackInventory: true,
  isAvailable: true,
  status: true,
  images: { orderBy: { orderIndex: 'asc' as const }, take: 1, select: { imageUrl: true } },
  business: { select: { id: true, name: true, status: true, verificationStatus: true } },
} satisfies Prisma.ProductSelect;

export type CartProduct = Prisma.ProductGetPayload<{ select: typeof cartProductSelect }>;

export const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: { product: { select: cartProductSelect } },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface VariantRow {
  id: string;
  productId: string;
  nameAr: string;
  nameEn: string;
  additionalPriceMinor: number;
  stockQuantity: number;
  isAvailable: boolean;
}

export const variantRowSelect = {
  id: true,
  productId: true,
  nameAr: true,
  nameEn: true,
  additionalPriceMinor: true,
  stockQuantity: true,
  isAvailable: true,
} satisfies Prisma.ProductVariantSelect;

export interface Evaluation {
  readonly unitPriceMinor: number;
  readonly stockQuantity: number;
  readonly isPurchasable: boolean;
}

/**
 * Resolves the current purchasability of one cart line: the product must be
 * listed, its business live and approved, an optional variant available, and
 * stock must exist when inventory is tracked. Prices are recomputed on every
 * read so a cart never quotes a stale price (BRD: automatic price refresh).
 */
export function evaluate(product: CartProduct, variant: VariantRow | null): Evaluation {
  const businessOk =
    product.business.status === 'ACTIVE' && product.business.verificationStatus === 'APPROVED';
  const listed = product.status === 'active' && product.isAvailable && businessOk;
  const variantOk = variant === null || variant.isAvailable;
  const stockQuantity = variant === null ? product.stockQuantity : variant.stockQuantity;
  const purchasable = listed && variantOk && (!product.trackInventory || stockQuantity > 0);
  const unitPriceMinor =
    salePriceMinor(product.priceMinor, product.discountPercent) +
    (variant === null ? 0 : variant.additionalPriceMinor);
  return { unitPriceMinor, stockQuantity, isPurchasable: purchasable };
}
