/**
 * Endpoint group for the public catalog: categories, products, and stores.
 *
 * The types mirror the transport contracts declared in
 * `apps/backend/src/modules/catalog/dto/catalog.dto.ts`. Money fields are
 * integer-minor-unit strings (ADR-0003): format them through `BigInt`, never
 * by casting to `number`.
 */

import type { PaginatedResult } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

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
  readonly priceMinor: string;
  readonly discountPercent: string;
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

export interface Advertisement {
  readonly id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly imageUrl: string;
  readonly targetUrl: string | null;
  readonly status: 'draft' | 'active' | 'paused' | 'archived';
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface ListProductsParams {
  readonly q?: string;
  readonly categoryId?: string;
  readonly businessId?: string;
  readonly sort?: ProductSort;
  readonly limit?: number;
  readonly cursor?: string;
}

export class CatalogApi {
  public constructor(private readonly client: ApiClient) {}

  /** Active category tree; cached briefly because it changes rarely. */
  public categories(): Promise<readonly CategoryNode[]> {
    return this.client.get<readonly CategoryNode[]>('/catalog/categories', {
      cacheKey: 'catalog:categories',
    });
  }

  public products(params: ListProductsParams = {}): Promise<PaginatedResult<ProductSummary>> {
    const query: Record<string, string | number> = {};
    if (params.q !== undefined) query.q = params.q;
    if (params.categoryId !== undefined) query.categoryId = params.categoryId;
    if (params.businessId !== undefined) query.businessId = params.businessId;
    if (params.sort !== undefined) query.sort = params.sort;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;

    return this.client.getPaged<ProductSummary>('/catalog/products', { query });
  }

  public product(productId: string): Promise<ProductDetail> {
    return this.client.get<ProductDetail>('/catalog/products/{id}', {
      pathParams: { id: productId },
      cacheKey: `catalog:product:${productId}`,
    });
  }

  public store(businessId: string): Promise<StoreProfile> {
    return this.client.get<StoreProfile>('/catalog/stores/{id}', {
      pathParams: { id: businessId },
      cacheKey: `catalog:store:${businessId}`,
    });
  }

  public advertisements(): Promise<readonly Advertisement[]> {
    return this.client.get<readonly Advertisement[]>('/advertisements', {
      anonymous: true,
      cacheKey: 'advertisements:active',
      cacheTtlMs: 60_000,
    });
  }
}
