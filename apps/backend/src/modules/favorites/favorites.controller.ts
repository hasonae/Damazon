import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';

import { CurrentUserId } from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FavoritesService } from './favorites.service.js';
import { favoriteProductIdParamSchema, type FavoritesResponse } from './dto/favorites.dto.js';

@Controller('favorites')
export class FavoritesController {
  public constructor(
    @Inject(FavoritesService) private readonly favoritesService: FavoritesService,
  ) {}

  @Get('products')
  @RequirePermissions(PERMISSIONS.FAVORITE_READ)
  public async listProducts(@CurrentUserId() userId: string): Promise<FavoritesResponse> {
    return { items: await this.favoritesService.listProducts(userId) };
  }

  @Post('products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.FAVORITE_MANAGE)
  public addProduct(
    @CurrentUserId() userId: string,
    @Param('productId', new ZodValidationPipe(favoriteProductIdParamSchema, { target: 'params' }))
    productId: string,
  ): Promise<void> {
    return this.favoritesService.addProduct(userId, productId);
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.FAVORITE_MANAGE)
  public removeProduct(
    @CurrentUserId() userId: string,
    @Param('productId', new ZodValidationPipe(favoriteProductIdParamSchema, { target: 'params' }))
    productId: string,
  ): Promise<void> {
    return this.favoritesService.removeProduct(userId, productId);
  }
}
