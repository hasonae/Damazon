import { z } from 'zod';

/**
 * Review transport contracts.
 *
 * A review is only ever written by a customer who completed the order it
 * belongs to, so the create payload carries the rating and the target while
 * the server resolves the qualifying order and the verified-purchase badge.
 */

export const REVIEW_TARGET_TYPES = ['product', 'business', 'driver'] as const;
export const REVIEW_STATUSES = ['pending', 'published', 'rejected', 'flagged'] as const;

export type ReviewTargetTypeOption = (typeof REVIEW_TARGET_TYPES)[number];
export type ReviewStatusOption = (typeof REVIEW_STATUSES)[number];

export const createReviewSchema = z
  .object({
    targetType: z.enum(REVIEW_TARGET_TYPES),
    targetId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type CreateReviewRequest = z.infer<typeof createReviewSchema>;

export const listReviewsQuerySchema = z
  .object({
    targetType: z.enum(REVIEW_TARGET_TYPES).optional(),
    targetId: z.string().uuid().optional(),
    status: z.enum(REVIEW_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.targetId !== undefined && value.targetType === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetType'],
        message: 'targetType is required when targetId is provided',
      });
    }
  });

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const moderateReviewSchema = z
  .object({ status: z.enum(['published', 'rejected', 'flagged']) })
  .strict();

export type ModerateReviewRequest = z.infer<typeof moderateReviewSchema>;

export const reviewIdParamSchema = z.string().uuid();

export interface ReviewAuthor {
  readonly id: string;
  readonly displayName: string;
}

export interface ReviewView {
  readonly id: string;
  readonly targetType: ReviewTargetTypeOption;
  readonly targetId: string;
  readonly productId: string | null;
  readonly orderId: string | null;
  readonly rating: number;
  readonly comment: string | null;
  readonly status: ReviewStatusOption;
  /** The badge the spec asks for: the review is tied to a real order. */
  readonly verifiedPurchase: boolean;
  readonly author: ReviewAuthor;
  readonly createdAt: string;
  readonly updatedAt: string;
}
