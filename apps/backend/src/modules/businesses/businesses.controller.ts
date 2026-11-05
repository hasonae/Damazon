import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';

import {
  CurrentPrincipal,
  CurrentUserId,
} from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BusinessesService } from './businesses.service.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import {
  businessIdParamSchema,
  createBusinessProductSchema,
  registerBusinessSchema,
  updateBusinessProductSchema,
  updateBusinessSchema,
  type BusinessProductView,
  type BusinessDetail,
  type BusinessNotification,
  type BusinessSummary,
  type CreateBusinessProductRequest,
  type RegisterBusinessRequest,
  type UpdateBusinessProductRequest,
  type UpdateBusinessRequest,
} from './dto/businesses.dto.js';

/**
 * Tenant self-service: owners register and manage their own businesses.
 * Cross-tenant reads resolve to the public profile, and review actions live
 * in the admin modules by design.
 */
@Controller('businesses')
export class BusinessesController {
  public constructor(
    @Inject(BusinessesService) private readonly businessesService: BusinessesService,
  ) {}

  @Get('mine')
  public listMine(@CurrentUserId() userId: string): Promise<readonly BusinessSummary[]> {
    return this.businessesService.listMine(userId);
  }

  @Get('notifications')
  public listSubscriptionNotifications(
    @CurrentUserId() userId: string,
  ): Promise<readonly BusinessNotification[]> {
    return this.businessesService.listSubscriptionNotifications(userId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STORE_CREATE)
  public registerBusiness(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(registerBusinessSchema, { target: 'body' }))
    payload: RegisterBusinessRequest,
  ): Promise<BusinessDetail> {
    return this.businessesService.registerBusiness(userId, payload);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STORE_READ)
  public getBusiness(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(businessIdParamSchema, { target: 'params' })) id: string,
  ): Promise<BusinessDetail> {
    return this.businessesService.getBusiness(userId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STORE_UPDATE)
  public updateBusiness(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(businessIdParamSchema, { target: 'params' })) id: string,
    @Body(new ZodValidationPipe(updateBusinessSchema, { target: 'body' }))
    payload: UpdateBusinessRequest,
  ): Promise<BusinessDetail> {
    return this.businessesService.updateBusiness(userId, id, payload);
  }

  @Get(':id/products')
  @RequirePermissions(PERMISSIONS.PRODUCT_READ)
  public listProducts(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(businessIdParamSchema, { target: 'params' })) id: string,
  ): Promise<readonly BusinessProductView[]> {
    return this.businessesService.listProducts(principal, id);
  }

  @Post(':id/products')
  @RequirePermissions(PERMISSIONS.PRODUCT_CREATE)
  public createProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(businessIdParamSchema, { target: 'params' })) id: string,
    @Body(new ZodValidationPipe(createBusinessProductSchema, { target: 'body' }))
    payload: CreateBusinessProductRequest,
  ): Promise<BusinessProductView> {
    return this.businessesService.createProduct(principal, id, payload);
  }

  @Patch(':id/products/:productId')
  @RequirePermissions(PERMISSIONS.PRODUCT_UPDATE)
  public updateProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(businessIdParamSchema, { target: 'params' })) id: string,
    @Param('productId', new ZodValidationPipe(businessIdParamSchema, { target: 'params' }))
    productId: string,
    @Body(new ZodValidationPipe(updateBusinessProductSchema, { target: 'body' }))
    payload: UpdateBusinessProductRequest,
  ): Promise<BusinessProductView> {
    return this.businessesService.updateProduct(principal, id, productId, payload);
  }
}
