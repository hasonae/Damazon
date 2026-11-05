import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS, type PaginatedResult } from '@damazon/shared-types';

import {
  CurrentPrincipal,
  CurrentUserId,
} from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import { ReviewsService } from './reviews.service.js';
import {
  createReviewSchema,
  listReviewsQuerySchema,
  moderateReviewSchema,
  reviewIdParamSchema,
  type CreateReviewRequest,
  type ListReviewsQuery,
  type ModerateReviewRequest,
  type ReviewView,
} from './dto/reviews.dto.js';

@Controller('reviews')
export class ReviewsController {
  public constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.REVIEW_CREATE)
  public createReview(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createReviewSchema, { target: 'body' }))
    payload: CreateReviewRequest,
  ): Promise<ReviewView> {
    return this.reviewsService.create(userId, payload);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEW_READ)
  public listReviews(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(listReviewsQuerySchema, { target: 'query' }))
    query: ListReviewsQuery,
  ): Promise<PaginatedResult<ReviewView>> {
    return this.reviewsService.list(principal, query);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.REVIEW_MODERATE)
  public moderateReview(
    @Param('id', new ZodValidationPipe(reviewIdParamSchema, { target: 'params' })) id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema, { target: 'body' }))
    payload: ModerateReviewRequest,
  ): Promise<ReviewView> {
    return this.reviewsService.moderate(id, payload);
  }
}
