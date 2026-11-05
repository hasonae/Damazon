/**
 * Endpoint group for orders and checkout.
 *
 * Checkout is a single request: the server validates inventory, splits the
 * cart by business, and returns one order per store.
 */

import type { PaginatedResult } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

export type OrderStatusFilter =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'driver_assigned'
  | 'driver_accepted'
  | 'on_the_way'
  | 'arrived'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'returned'
  | 'expired'
  | 'failed'
  | 'disputed';

export type SellerOrderStatus = 'preparing' | 'ready';

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly paymentMethod: string | null;
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly logoUrl: string | null;
  };
  readonly itemCount: number;
  readonly subtotalMinor: string;
  readonly deliveryFeeMinor: string;
  readonly totalMinor: string;
  readonly currency: string;
  readonly destinationKind: string;
  readonly createdAt: string;
  readonly placedAt: string | null;
}

export interface OrderItemView {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly imageUrl: string | null;
  readonly unitPriceMinor: string;
  readonly quantity: number;
  readonly totalMinor: string;
}

export interface OrderStatusEvent {
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly actorType: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  readonly items: readonly OrderItemView[];
  readonly history: readonly OrderStatusEvent[];
  readonly customerNote: string | null;
  readonly deliveryInstructions: string | null;
  readonly deliveryZone: { readonly id: string; readonly name: string } | null;
  readonly recipientName: string | null;
  readonly recipientPhone: string | null;
  readonly cancellationReason: string | null;
  readonly estimatedDeliveryAt: string | null;
}

export interface OrderDriverLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly updatedAt: string;
}

export interface OrderTracking {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly deliveryTaskStatus: string | null;
  readonly driver: { readonly id: string; readonly name: string; readonly phone: string } | null;
  readonly driverLocation: OrderDriverLocation | null;
  readonly pickup: { readonly latitude: number | null; readonly longitude: number | null } | null;
  readonly destination: {
    readonly latitude: number | null;
    readonly longitude: number | null;
  } | null;
  readonly estimatedArrivalAt: string | null;
  readonly deliveredAt: string | null;
}

export type PaymentMethodOption = 'cash_on_delivery';

export type DeliveryDestinationKind =
  'home_address' | 'damazon_zone' | 'pickup' | 'third_party_recipient';

export interface CreateOrderRequest {
  readonly paymentMethod: PaymentMethodOption;
  readonly destinationKind?: DeliveryDestinationKind;
  readonly deliveryZoneId?: string;
  readonly deliveryAddressId?: string;
  readonly deliveryInstructions?: string;
  readonly recipientName?: string;
  readonly recipientPhone?: string;
  readonly customerNote?: string;
}

export interface CreateOrderResponse {
  readonly orders: readonly OrderSummary[];
}

export interface ListOrdersParams {
  readonly status?: OrderStatusFilter;
  readonly limit?: number;
  readonly cursor?: string;
}

export class OrdersApi {
  public constructor(private readonly client: ApiClient) {}

  public async create(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const created = await this.client.post<CreateOrderResponse>('/orders', request);
    // Stock and totals changed: drop the cart and re-fetch catalog pages on
    // the next read instead of showing quantities that no longer exist.
    this.client.clearCache('cart');
    this.client.clearCache('catalog:');
    this.client.clearCache('orders');
    return created;
  }

  public list(params: ListOrdersParams = {}): Promise<PaginatedResult<OrderSummary>> {
    const query: Record<string, string | number> = {};
    if (params.status !== undefined) query.status = params.status;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;

    return this.client.getPaged<OrderSummary>('/orders', { query });
  }

  public listBusiness(params: ListOrdersParams = {}): Promise<PaginatedResult<OrderSummary>> {
    const query: Record<string, string | number> = {};
    if (params.status !== undefined) query.status = params.status;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;

    return this.client.getPaged<OrderSummary>('/orders/business', { query });
  }

  public async updateBusinessStatus(
    orderId: string,
    status: SellerOrderStatus,
  ): Promise<OrderDetail> {
    const detail = await this.client.post<OrderDetail>(
      '/orders/business/{id}/status',
      { status },
      { pathParams: { id: orderId } },
    );
    this.client.clearCache('orders');
    return detail;
  }

  public get(orderId: string): Promise<OrderDetail> {
    return this.client.get<OrderDetail>('/orders/{id}', {
      pathParams: { id: orderId },
      cacheKey: `orders:${orderId}`,
    });
  }

  public async cancel(orderId: string, reason: string): Promise<OrderDetail> {
    const detail = await this.client.post<OrderDetail>(
      '/orders/{id}/cancel',
      { reason },
      { pathParams: { id: orderId } },
    );
    this.client.clearCache('orders');
    return detail;
  }

  public async track(orderId: string): Promise<OrderTracking> {
    return this.client.get<OrderTracking>('/orders/{id}/tracking', {
      pathParams: { id: orderId },
      cacheKey: `orders:${orderId}:tracking`,
      cacheTtlMs: 10_000,
    });
  }
}
