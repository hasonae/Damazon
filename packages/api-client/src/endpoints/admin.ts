import type { OrderStatus, PaginatedResult } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

export interface AdminOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly business: string;
  readonly city: string;
  readonly status: OrderStatus;
  readonly totalMinorUnits: string;
  readonly currency: string;
  readonly createdAt: string;
}

export interface AdminBusinessReview {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly verificationStatus: string;
  readonly businessStatus: string;
  readonly subscriptionSuspendedAt: string | null;
  readonly ownerName: string;
  readonly ownerPhone: string;
  readonly city: string;
  readonly documentCount: number;
  readonly approvedDocumentCount: number;
  readonly subscriptionStatus: string | null;
  readonly subscriptionAmount: number | null;
  readonly subscriptionCurrency: string | null;
  readonly subscriptionPeriodEnd: string | null;
  readonly hasActiveSubscription: boolean;
  readonly createdAt: string;
}

export interface AdminDashboard {
  readonly totalOrders: number;
  readonly openOrders: number;
  readonly activeBusinesses: number;
  readonly businessesAwaitingReview: number;
  readonly recentOrders: readonly AdminOrder[];
}

export interface AdminUserView {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly status: string;
  readonly roles: readonly string[];
  readonly activeBusinessId: string | null;
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface AdminDriverView {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string;
  readonly status: string;
  readonly applicationStatus: string;
  readonly vehicleType: string;
  readonly completedDeliveries: number;
  readonly companyId: string | null;
  readonly companyName: string | null;
}

export interface AdminAuditLogView {
  readonly id: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly actorRole: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly newValue: unknown;
  readonly createdAt: string;
}

export interface AdminAuditLogPage {
  readonly items: readonly AdminAuditLogView[];
  readonly meta: {
    readonly limit: number;
    readonly hasMore: boolean;
    readonly nextCursor: string | null;
    readonly totalCount: number;
  };
}

export interface AdminAdvertisement {
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

export interface SaveAdvertisementRequest {
  readonly title?: string;
  readonly caption?: string | null;
  readonly imageUrl?: string;
  readonly targetUrl?: string | null;
  readonly status?: AdminAdvertisement['status'];
  readonly startsAt?: string;
  readonly endsAt?: string | null;
  readonly position?: number;
}

export interface CreateAdvertisementRequest extends SaveAdvertisementRequest {
  readonly title: string;
  readonly imageUrl: string;
  readonly status: AdminAdvertisement['status'];
}

export interface AdminListParams {
  readonly status?: OrderStatus;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AdminUserListParams {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AdminAuditLogListParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly actorId?: string;
  readonly entityType?: string;
}

export class AdminApi {
  public constructor(private readonly client: ApiClient) {}

  public dashboard(): Promise<AdminDashboard> {
    return this.client.get('/admin/dashboard');
  }

  public advertisements(): Promise<readonly AdminAdvertisement[]> {
    return this.client.get<readonly AdminAdvertisement[]>('/admin/advertisements');
  }

  public createAdvertisement(request: CreateAdvertisementRequest): Promise<AdminAdvertisement> {
    return this.client.post<AdminAdvertisement>('/admin/advertisements', request);
  }

  public updateAdvertisement(
    advertisementId: string,
    request: SaveAdvertisementRequest,
  ): Promise<AdminAdvertisement> {
    return this.client.patch<AdminAdvertisement>('/admin/advertisements/{id}', request, {
      pathParams: { id: advertisementId },
    });
  }

  public listOrders(params: AdminListParams = {}): Promise<PaginatedResult<AdminOrder>> {
    const query: Record<string, string | number> = {};
    if (params.status !== undefined) query.status = params.status;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;
    return this.client.getPaged('/admin/orders', { query });
  }

  public reviewBusinesses(): Promise<readonly AdminBusinessReview[]> {
    return this.client.get('/admin/businesses/review');
  }

  public approveBusiness(businessId: string): Promise<void> {
    return this.client.post('/admin/businesses/{id}/approve', undefined, {
      pathParams: { id: businessId },
    });
  }

  public rejectBusiness(businessId: string, reason: string): Promise<void> {
    return this.client.post(
      '/admin/businesses/{id}/reject',
      { reason },
      { pathParams: { id: businessId } },
    );
  }

  public confirmBusinessCashSubscription(businessId: string, note?: string): Promise<void> {
    return this.client.post(
      '/admin/businesses/{id}/cash-subscription',
      { cashReceived: true, note },
      { pathParams: { id: businessId } },
    );
  }

  public listUsers(params: AdminUserListParams = {}): Promise<PaginatedResult<AdminUserView>> {
    const query: Record<string, string | number> = {};
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;
    return this.client.getPaged('/admin/users', { query });
  }

  public updateUserStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED',
  ): Promise<void> {
    return this.client.patch(
      '/admin/users/{id}/status',
      { status },
      { pathParams: { id: userId } },
    );
  }

  public listDrivers(): Promise<readonly AdminDriverView[]> {
    return this.client.get('/admin/drivers');
  }

  public updateDriverStatus(
    driverId: string,
    status: 'available' | 'offline' | 'on_break' | 'suspended',
  ): Promise<void> {
    return this.client.patch(
      '/admin/drivers/{id}/status',
      { status },
      { pathParams: { id: driverId } },
    );
  }

  public approveDriverApplication(driverId: string, companyBusinessId: string): Promise<void> {
    return this.client.post(
      '/admin/drivers/{id}/approve',
      { companyBusinessId },
      { pathParams: { id: driverId } },
    );
  }

  public rejectDriverApplication(driverId: string, reason: string): Promise<void> {
    return this.client.post(
      '/admin/drivers/{id}/reject',
      { reason },
      { pathParams: { id: driverId } },
    );
  }

  public async listAuditLogs(params: AdminAuditLogListParams = {}): Promise<AdminAuditLogPage> {
    const query: Record<string, string | number> = {};
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;
    if (params.actorId !== undefined) query.actorId = params.actorId;
    if (params.entityType !== undefined) query.entityType = params.entityType;
    const page = await this.client.getPaged<AdminAuditLogView>('/admin/audit-logs', { query });
    return {
      items: page.items,
      meta: {
        limit: page.meta.limit,
        hasMore: page.meta.hasMore,
        nextCursor: page.meta.nextCursor,
        totalCount: page.meta.totalCount ?? 0,
      },
    };
  }
}
