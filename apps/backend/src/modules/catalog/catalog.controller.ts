import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';
import {
  listProductsQuerySchema,
  uuidParamSchema,
  type CategoryNode,
  type ListProductsQuery,
  type ProductDetail,
  type StoreProfile,
} from './dto/catalog.dto.js';
import type { ProductSummary } from './dto/catalog.dto.js';
import type { PaginatedResult } from '@damazon/shared-types';

/**
 * Public catalog: guests browse before they ever create an account, so every
 * route here is `@Public()`. Mutations live in their own permissioned modules.
 */
@Controller('catalog')
export class CatalogController {
  public constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Public()
  @Get('categories')
  public listCategories(): Promise<readonly CategoryNode[]> {
    return this.catalogService.listCategories();
  }

  @Public()
  @Get('products')
  public listProducts(
    @Query(new ZodValidationPipe(listProductsQuerySchema, { target: 'query' }))
    query: ListProductsQuery,
  ): Promise<PaginatedResult<ProductSummary>> {
    return this.catalogService.listProducts(query);
  }

  @Public()
  @Get('products/:id')
  public getProduct(
    @Param('id', new ZodValidationPipe(uuidParamSchema, { target: 'params' })) id: string,
  ): Promise<ProductDetail> {
    return this.catalogService.getProduct(id);
  }

  @Public()
  @Get('stores/:id')
  public getStore(
    @Param('id', new ZodValidationPipe(uuidParamSchema, { target: 'params' })) id: string,
  ): Promise<StoreProfile> {
    return this.catalogService.getStore(id);
  }
}
