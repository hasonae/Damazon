/**
 * Aggregated client handed to application code.
 *
 * Endpoint groups are attached once so a screen imports one object rather than
 * constructing a client per feature. Adding a domain means adding a group here,
 * which keeps the surface discoverable.
 */

import { ApiClient, type ApiClientOptions } from './client.js';
import { AdminApi } from './endpoints/admin.js';
import {
  AuthApi,
  type EmailVerificationPending,
  type LoginRequest,
  type RegisterRequest,
  type SessionPayload,
} from './endpoints/auth.js';
import { BusinessesApi } from './endpoints/businesses.js';
import { CartApi } from './endpoints/cart.js';
import { CatalogApi } from './endpoints/catalog.js';
import { DeliveryApi } from './endpoints/delivery.js';
import { FavoritesApi } from './endpoints/favorites.js';
import { HealthApi } from './endpoints/health.js';
import { OrdersApi } from './endpoints/orders.js';
import { ReviewsApi } from './endpoints/reviews.js';
import { UsersApi, type DeliveryZone, type UpdateProfileRequest } from './endpoints/users.js';
import { MemoryTokenStorage, type TokenStorage } from './token-storage.js';

export { ApiClient } from './client.js';
export type { ApiClientOptions, EnvelopedResult, SendOptions } from './client.js';
export { ApiProtocolError, ApiRequestError, ApiTransportError, isApiError } from './errors.js';
export { buildHeaders, buildPath, buildQueryString, paginationParams } from './request.js';
export type { HttpMethod, QueryParams, QueryValue, RequestOptions } from './request.js';
export { MemoryTokenStorage } from './token-storage.js';
export type { TokenPair, TokenStorage } from './token-storage.js';
export { AuthApi } from './endpoints/auth.js';
export { AdminApi } from './endpoints/admin.js';
export type {
  AdminAuditLogListParams,
  AdminAuditLogPage,
  AdminAuditLogView,
  AdminAdvertisement,
  AdminBusinessReview,
  AdminDashboard,
  AdminDriverView,
  AdminListParams,
  AdminOrder,
  AdminUserListParams,
  AdminUserView,
  CreateAdvertisementRequest,
  SaveAdvertisementRequest,
} from './endpoints/admin.js';
export type {
  AuthenticatedUser,
  CompletePasswordRecoveryRequest,
  EmailVerificationPending,
  LoginRequest,
  PasswordRecoveryStarted,
  RegisterRequest,
  SessionPayload,
} from './endpoints/auth.js';
export { UsersApi } from './endpoints/users.js';
export type { DeliveryZone, UpdateProfileRequest, UpsertZoneRequest } from './endpoints/users.js';
export { HealthApi } from './endpoints/health.js';
export type { HealthReport } from './endpoints/health.js';
export { CatalogApi } from './endpoints/catalog.js';
export type {
  BusinessRef,
  Advertisement,
  CategoryNode,
  CategoryRef,
  ListProductsParams,
  ProductDetail,
  ProductSort,
  ProductSummary,
  ProductVariantOption,
  StoreProfile,
} from './endpoints/catalog.js';
export { CartApi } from './endpoints/cart.js';
export type { AddCartItemRequest, CartItemView, CartResponse } from './endpoints/cart.js';
export { OrdersApi } from './endpoints/orders.js';
export type {
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryDestinationKind,
  ListOrdersParams,
  OrderDetail,
  OrderDriverLocation,
  OrderItemView,
  OrderStatusEvent,
  OrderStatusFilter,
  OrderSummary,
  OrderTracking,
  PaymentMethodOption,
  SellerOrderStatus,
} from './endpoints/orders.js';
export { FavoritesApi } from './endpoints/favorites.js';
export { ReviewsApi } from './endpoints/reviews.js';
export type {
  CreateReviewRequest,
  ListReviewsParams,
  ModerateReviewRequest,
  ReviewAuthor,
  ReviewStatusFilter,
  ReviewTargetType,
  ReviewView,
} from './endpoints/reviews.js';
export { BusinessesApi } from './endpoints/businesses.js';
export { DeliveryApi } from './endpoints/delivery.js';
export type {
  DeliveryDriver,
  DeliveryTask,
  DriverApplication,
  DriverApplicationRequest,
  DriverAvailability,
  DriverVehicleType,
} from './endpoints/delivery.js';
export type { DeliveryTaskStatus, DriverStatus } from '@damazon/shared-types';
export type {
  BusinessProductStatus,
  BusinessProductView,
  CreateBusinessProductRequest,
  BusinessDetail,
  BusinessNotification,
  BusinessSummary,
  BusinessTypeOption,
  RegisterBusinessRequest as RegisterBusinessClientRequest,
  SaveBusinessProductRequest,
} from './endpoints/businesses.js';

export interface DamazonClientOptions extends Omit<ApiClientOptions, 'tokenStorage'> {
  readonly tokenStorage?: TokenStorage;
}

export class DamazonClient {
  public readonly http: ApiClient;
  public readonly auth: AuthApi;
  public readonly admin: AdminApi;
  public readonly users: UsersApi;
  public readonly health: HealthApi;
  public readonly catalog: CatalogApi;
  public readonly cart: CartApi;
  public readonly orders: OrdersApi;
  public readonly favorites: FavoritesApi;
  public readonly businesses: BusinessesApi;
  public readonly delivery: DeliveryApi;
  public readonly reviews: ReviewsApi;

  public constructor(options: DamazonClientOptions) {
    this.http = new ApiClient({
      ...options,
      tokenStorage: options.tokenStorage ?? new MemoryTokenStorage(),
      refreshSession: options.refreshSession ?? (() => this.auth.refresh()),
    });
    this.auth = new AuthApi(this.http);
    this.admin = new AdminApi(this.http);
    this.users = new UsersApi(this.http);
    this.health = new HealthApi(this.http);
    this.catalog = new CatalogApi(this.http);
    this.cart = new CartApi(this.http);
    this.orders = new OrdersApi(this.http);
    this.favorites = new FavoritesApi(this.http);
    this.businesses = new BusinessesApi(this.http);
    this.delivery = new DeliveryApi(this.http);
    this.reviews = new ReviewsApi(this.http);
  }

  /** Convenience for sign-in screens: authenticate and store the session. */
  public async signIn(credentials: LoginRequest, storage: TokenStorage): Promise<SessionPayload> {
    const session = await this.auth.login(credentials);
    await storage.writeSession(session);
    return session;
  }

  public async registerAccount(request: RegisterRequest): Promise<EmailVerificationPending> {
    return this.auth.register(request);
  }

  public async signOut(storage: TokenStorage): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      // Local state is cleared even if the server call fails, so a user is never
      // left holding a token they asked to discard.
      await storage.clearSession();
    }
  }

  public async preferredZone(): Promise<DeliveryZone | null> {
    const zones = await this.users.zones();
    return zones.find((zone) => zone.isDefault) ?? zones[0] ?? null;
  }

  public updateProfile(request: UpdateProfileRequest): Promise<unknown> {
    return this.users.updateProfile(request);
  }
}
