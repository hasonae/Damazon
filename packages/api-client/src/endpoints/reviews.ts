/**
 * Endpoint group for product, business, and driver reviews.
 *
 * The customer posts a rating and the target; the server resolves the
 * completed order behind the verified-purchase badge, so the client never
 * assembles that proof itself.
 */

import type { PaginatedResult } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

export type ReviewTargetType = 'product' | 'business' | 'driver';

export type ReviewStatusFilter = 'pending' | 'published' | 'rejected' | 'flagged';

export interface ReviewAuthor {
  readonly id: string;
  readonly displayName: string;
}

export interface ReviewView {
  readonly id: string;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly productId: string | null;
  readonly orderId: string | null;
  readonly rating: number;
  readonly comment: string | null;
  readonly status: ReviewStatusFilter;
  readonly verifiedPurchase: boolean;
  readonly author: ReviewAuthor;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateReviewRequest {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly comment?: string;
}

export interface ModerateReviewRequest {
  readonly status: 'published' | 'rejected' | 'flagged';
}

export interface ListReviewsParams {
  readonly targetType?: ReviewTargetType;
  readonly targetId?: string;
  readonly status?: ReviewStatusFilter;
  readonly limit?: number;
  readonly cursor?: string;
}

export class ReviewsApi {
  public constructor(private readonly client: ApiClient) {}

  public async create(request: CreateReviewRequest): Promise<ReviewView> {
    const created = await this.client.post<ReviewView>('/reviews', request);
    // Product and store cards carry cached rating aggregates; drop them so the
    // next read shows the number this review moved.
    this.client.clearCache('reviews:');
    this.client.clearCache('catalog:');
    return created;
  }

  public list(params: ListReviewsParams = {}): Promise<PaginatedResult<ReviewView>> {
    const query: Record<string, string | number> = {};
    if (params.targetType !== undefined) query.targetType = params.targetType;
    if (params.targetId !== undefined) query.targetId = params.targetId;
    if (params.status !== undefined) query.status = params.status;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.cursor !== undefined) query.cursor = params.cursor;

    return this.client.getPaged<ReviewView>('/reviews', { query });
  }

  public async moderate(reviewId: string, request: ModerateReviewRequest): Promise<ReviewView> {
    const updated = await this.client.patch<ReviewView>('/reviews/{id}', request, {
      pathParams: { id: reviewId },
    });
    this.client.clearCache('reviews:');
    this.client.clearCache('catalog:');
    return updated;
  }
}
