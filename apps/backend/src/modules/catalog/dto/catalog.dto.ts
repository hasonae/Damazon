import { z } from 'zod';

/**
 * Transport contracts for the public catalog.
 *
 * Money is exposed as an integer-minor-unit string (ADR-0003) so that no
 * client can accidentally do floating point arithmetic on an amount, and the
 * display layer converts with `BigInt` before formatting.
 */

export const listProductsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    categoryId: z.string().uuid().optional(),
    businessId: z.string().uuid().optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const uuidParamSchema = z.string().uuid();

export interface CategoryNode {
  readonly id: string;
  readonly slug: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly imageUrl: string | null;
  readonly children: readonly CategoryNode[];
}

export interface BusinessRef {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly type: string;
  readonly ratingAverage: string;
  readonly ratingCount: number;
}

export interface CategoryRef {
  readonly id: string;
  readonly slug: string;
  readonly nameAr: string;
  readonly nameEn: string;
}

export interface ProductSummary {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  /** List price in integer minor units, serialized as a string. */
  readonly priceMinor: string;
  /** Applied discount as a decimal string, for example "12.50". */
  readonly discountPercent: string;
  /** Effective price after the discount, serialized as a string. */
  readonly salePriceMinor: string;
  readonly currency: string;
  readonly stockQuantity: number;
  readonly isAvailable: boolean;
  readonly ratingAverage: string;
  readonly ratingCount: number;
  readonly business: BusinessRef;
  readonly category: CategoryRef | null;
}

export interface ProductVariantOption {
  readonly id: string;
  readonly sku: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly additionalPriceMinor: string;
  readonly stockQuantity: number;
  readonly isAvailable: boolean;
}

export interface ProductDetail extends ProductSummary {
  readonly description: string | null;
  readonly barcode: string | null;
  readonly images: readonly string[];
  readonly variants: readonly ProductVariantOption[];
  readonly createdAt: string;
}

export interface StoreProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly logoUrl: string | null;
  readonly coverImageUrl: string | null;
  readonly phone: string;
  readonly type: string;
  readonly city: string | null;
  readonly ratingAverage: string;
  readonly ratingCount: number;
  readonly productCount: number;
  readonly createdAt: string;
}
