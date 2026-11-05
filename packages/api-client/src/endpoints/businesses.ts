/**
 * Endpoint group for business tenants: registration and owner management.
 *
 * Approval and suspension are administrative actions served by later admin
 * endpoints — self-service here never approves its own business.
 */

import type { ApiClient } from '../client.js';

export type BusinessTypeOption = 'merchant' | 'restaurant' | 'delivery_company';

export interface RegisterBusinessRequest {
  readonly type: BusinessTypeOption;
  readonly name: string;
  readonly description?: string;
  readonly phone: string;
  readonly email?: string;
  readonly logoUrl?: string;
  readonly coverImageUrl?: string;
  readonly cityId?: string;
  readonly addressLine?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface BusinessSummary {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly coverImageUrl: string | null;
  readonly status: string;
  readonly verificationStatus: string;
  readonly subscriptionSuspendedAt: string | null;
  readonly ratingAverage: string;
  readonly ratingCount: number;
  readonly subscription: {
    readonly status: string;
    readonly amount: number;
    readonly currency: string;
    readonly periodEnd: string;
  } | null;
  readonly createdAt: string;
}

export interface BusinessNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface BusinessDetail extends BusinessSummary {
  readonly description: string | null;
  readonly phone: string;
  readonly email: string | null;
  readonly city: { readonly id: string; readonly nameAr: string; readonly nameEn: string } | null;
  readonly addressLine: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly isOwner: boolean;
}

export type BusinessProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'archived';

export interface BusinessProductView {
  readonly id: string;
  readonly sku: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly description: string | null;
  readonly priceMinor: string;
  readonly currency: string;
  readonly stockQuantity: number;
  readonly isAvailable: boolean;
  readonly status: BusinessProductStatus;
  readonly categoryId: string | null;
  readonly imageUrls: readonly string[];
  readonly updatedAt: string;
}

export interface SaveBusinessProductRequest {
  readonly sku?: string;
  readonly nameAr?: string;
  readonly nameEn?: string;
  readonly description?: string | null;
  readonly priceMinor?: number;
  readonly categoryId?: string | null;
  readonly stockQuantity?: number;
  readonly isAvailable?: boolean;
  readonly status?: BusinessProductStatus;
  readonly imageUrls?: readonly string[];
}

export interface CreateBusinessProductRequest extends SaveBusinessProductRequest {
  readonly sku: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly priceMinor: number;
  readonly imageUrls: readonly string[];
}

export class BusinessesApi {
  public constructor(private readonly client: ApiClient) {}

  public mine(): Promise<readonly BusinessSummary[]> {
    return this.client.get<readonly BusinessSummary[]>('/businesses/mine', {
      cacheKey: 'businesses:mine',
    });
  }

  public subscriptionNotifications(): Promise<readonly BusinessNotification[]> {
    return this.client.get('/businesses/notifications', {
      cacheKey: 'businesses:notifications',
    });
  }

  public async register(request: RegisterBusinessRequest): Promise<BusinessDetail> {
    const created = await this.client.post<BusinessDetail>('/businesses', request);
    this.client.clearCache('businesses:');
    return created;
  }

  public get(businessId: string): Promise<BusinessDetail> {
    return this.client.get<BusinessDetail>('/businesses/{id}', {
      pathParams: { id: businessId },
      cacheKey: `businesses:${businessId}`,
    });
  }

  public async update(
    businessId: string,
    request: Partial<RegisterBusinessRequest>,
  ): Promise<BusinessDetail> {
    const updated = await this.client.patch<BusinessDetail>('/businesses/{id}', request, {
      pathParams: { id: businessId },
    });
    this.client.clearCache('businesses:');
    return updated;
  }

  public async products(businessId: string): Promise<readonly BusinessProductView[]> {
    return this.client.get<readonly BusinessProductView[]>('/businesses/{id}/products', {
      pathParams: { id: businessId },
    });
  }

  public async createProduct(
    businessId: string,
    request: CreateBusinessProductRequest,
  ): Promise<BusinessProductView> {
    const product = await this.client.post<BusinessProductView>(
      '/businesses/{id}/products',
      request,
      { pathParams: { id: businessId } },
    );
    this.clearProductCaches();
    return product;
  }

  public async updateProduct(
    businessId: string,
    productId: string,
    request: SaveBusinessProductRequest,
  ): Promise<BusinessProductView> {
    const product = await this.client.patch<BusinessProductView>(
      '/businesses/{id}/products/{productId}',
      request,
      { pathParams: { id: businessId, productId } },
    );
    this.clearProductCaches();
    return product;
  }

  private clearProductCaches(): void {
    this.client.clearCache('catalog:');
    this.client.clearCache('businesses:');
  }
}
