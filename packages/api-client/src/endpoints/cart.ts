/**
 * Endpoint group for the shopping cart.
 *
 * Every mutation returns the refreshed cart, so a screen updates its state
 * from the response instead of issuing a follow-up read.
 */

import type { ApiClient } from '../client.js';

export interface CartItemProductRef {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  readonly currency: string;
  readonly businessId: string;
  readonly businessName: string;
}

export interface CartItemView {
  readonly id: string;
  readonly quantity: number;
  readonly unitPriceMinor: string;
  readonly lineTotalMinor: string;
  readonly isPurchasable: boolean;
  readonly stockQuantity: number;
  readonly variant: {
    readonly id: string;
    readonly nameAr: string;
    readonly nameEn: string;
  } | null;
  readonly product: CartItemProductRef;
}

export interface CartResponse {
  readonly id: string;
  readonly itemCount: number;
  readonly subtotalMinor: string;
  readonly currency: string;
  readonly items: readonly CartItemView[];
}

export interface AddCartItemRequest {
  readonly productId: string;
  readonly variantId?: string;
  readonly quantity?: number;
}

export class CartApi {
  public constructor(private readonly client: ApiClient) {}

  public get(): Promise<CartResponse> {
    return this.client.get<CartResponse>('/cart', { cacheKey: 'cart' });
  }

  public async addItem(request: AddCartItemRequest): Promise<CartResponse> {
    const cart = await this.client.post<CartResponse>('/cart/items', request);
    this.client.clearCache('cart');
    return cart;
  }

  public async updateItem(itemId: string, quantity: number): Promise<CartResponse> {
    const cart = await this.client.patch<CartResponse>(
      '/cart/items/{itemId}',
      { quantity },
      { pathParams: { itemId } },
    );
    this.client.clearCache('cart');
    return cart;
  }

  public async removeItem(itemId: string): Promise<CartResponse> {
    const cart = await this.client.delete<CartResponse>('/cart/items/{itemId}', {
      pathParams: { itemId },
    });
    this.client.clearCache('cart');
    return cart;
  }

  public async clear(): Promise<void> {
    await this.client.delete<null>('/cart');
    this.client.clearCache('cart');
  }
}
