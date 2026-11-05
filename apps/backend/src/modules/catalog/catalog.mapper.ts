/**
 * Shared product/catalog mapping.
 *
 * Cart, orders, favorites, and the catalog controller all render the same
 * product shape; keeping the translation from a Prisma row to the transport
 * contract in one module is what stops the four call sites from drifting
 * (Rule 9: never duplicate business logic).
 */

import type { Prisma } from '@prisma/client';

import type {
  BusinessRef,
  CategoryRef,
  ProductDetail,
  ProductSummary,
  ProductVariantOption,
} from './dto/catalog.dto.js';

/** One image only, ordered first, for list views. */
export const productSummaryInclude = {
  images: { orderBy: { orderIndex: 'asc' as const }, take: 1 },
  business: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      type: true,
      ratingAverage: true,
      ratingCount: true,
      // Not exposed in the payload; the favorites list uses it to drop
      // products whose business stopped trading.
      status: true,
      verificationStatus: true,
    },
  },
  category: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  images: { orderBy: { orderIndex: 'asc' as const } },
  variants: { orderBy: { createdAt: 'asc' as const } },
  business: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      type: true,
      ratingAverage: true,
      ratingCount: true,
      status: true,
      verificationStatus: true,
    },
  },
  category: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
} satisfies Prisma.ProductInclude;

export type ProductSummaryRow = Prisma.ProductGetPayload<{
  include: typeof productSummaryInclude;
}>;

export type ProductDetailRow = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

/**
 * A product is publicly listed only when its own status is `active` and the
 * owning business is live and approved. Draft, suspended, or unreviewed
 * inventory must never reach a customer screen.
 */
export function visibleProductFilter(now = new Date()): Prisma.ProductWhereInput {
  return {
    status: 'active',
    business: {
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
      subscriptions: {
        some: { status: 'active', periodStart: { lte: now }, periodEnd: { gt: now } },
      },
    },
  };
}

/** A publicly visible business (used by the store profile endpoint). */
export function publicBusinessFilter(now = new Date()): Prisma.BusinessWhereInput {
  return {
    status: 'ACTIVE',
    verificationStatus: 'APPROVED',
    subscriptions: {
      some: { status: 'active', periodStart: { lte: now }, periodEnd: { gt: now } },
    },
  };
}

/**
 * Effective unit price in minor units: the list price reduced by the
 * discount percentage, rounded once at the boundary. Prices stay integers
 * all the way to the display layer.
 */
export function salePriceMinor(priceMinor: number, discountPercent: unknown): number {
  const discount = Number(String(discountPercent));
  if (!Number.isFinite(discount) || discount <= 0) {
    return priceMinor;
  }
  return Math.round((priceMinor * (100 - Math.min(discount, 100))) / 100);
}

function toBusinessRef(row: ProductSummaryRow['business']): BusinessRef {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    type: row.type,
    ratingAverage: String(row.ratingAverage),
    ratingCount: row.ratingCount,
  };
}

function toCategoryRef(row: ProductSummaryRow['category']): CategoryRef | null {
  if (row === null) {
    return null;
  }
  return { id: row.id, slug: row.slug, nameAr: row.nameAr, nameEn: row.nameEn };
}

export function toProductSummary(row: ProductSummaryRow): ProductSummary {
  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    sku: row.sku,
    imageUrl: row.images[0]?.imageUrl ?? null,
    priceMinor: String(row.priceMinor),
    discountPercent: String(row.discountPercent),
    salePriceMinor: String(salePriceMinor(row.priceMinor, row.discountPercent)),
    currency: row.currency,
    stockQuantity: row.stockQuantity,
    isAvailable: row.isAvailable,
    ratingAverage: String(row.ratingAverage),
    ratingCount: row.ratingCount,
    business: toBusinessRef(row.business),
    category: toCategoryRef(row.category),
  };
}

function toVariantOption(row: ProductDetailRow['variants'][number]): ProductVariantOption {
  return {
    id: row.id,
    sku: row.sku,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    additionalPriceMinor: String(row.additionalPriceMinor),
    stockQuantity: row.stockQuantity,
    isAvailable: row.isAvailable,
  };
}

export function toProductDetail(row: ProductDetailRow): ProductDetail {
  return {
    ...toProductSummary(row),
    description: row.description,
    barcode: row.barcode,
    images: row.images.map((image) => image.imageUrl),
    variants: row.variants.map(toVariantOption),
    createdAt: row.createdAt.toISOString(),
  };
}
