/**
 * Endpoint group for the customer's saved products.
 */

import type { ApiClient } from '../client.js';

import type { ProductSummary } from './catalog.js';

export class FavoritesApi {
  public constructor(private readonly client: ApiClient) {}

  public async products(): Promise<readonly ProductSummary[]> {
    const result = await this.client.get<{ items: readonly ProductSummary[] }>(
      '/favorites/products',
      { cacheKey: 'favorites:products' },
    );
    return result.items;
  }

  public async add(productId: string): Promise<void> {
    await this.client.post<null>('/favorites/products/{id}', undefined, {
      pathParams: { id: productId },
    });
    this.client.clearCache('favorites:');
  }

  public async remove(productId: string): Promise<void> {
    await this.client.delete<null>('/favorites/products/{id}', { pathParams: { id: productId } });
    this.client.clearCache('favorites:');
  }
}
