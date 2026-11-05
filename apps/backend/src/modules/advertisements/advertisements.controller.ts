import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';

import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import { AdvertisementsService } from './advertisements.service.js';
import {
  advertisementIdSchema,
  createAdvertisementSchema,
  updateAdvertisementSchema,
  type AdvertisementView,
  type CreateAdvertisementRequest,
  type UpdateAdvertisementRequest,
} from './dto/advertisements.dto.js';

@Controller('advertisements')
export class PublicAdvertisementsController {
  public constructor(
    @Inject(AdvertisementsService) private readonly advertisementsService: AdvertisementsService,
  ) {}

  @Public()
  @Get()
  public listActive(): Promise<readonly AdvertisementView[]> {
    return this.advertisementsService.listActive();
  }
}

@Controller('admin/advertisements')
export class AdminAdvertisementsController {
  public constructor(
    @Inject(AdvertisementsService) private readonly advertisementsService: AdvertisementsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ADVERTISEMENT_READ)
  public listAll(): Promise<readonly AdvertisementView[]> {
    return this.advertisementsService.listAll();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ADVERTISEMENT_CREATE)
  public create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(createAdvertisementSchema, { target: 'body' }))
    payload: CreateAdvertisementRequest,
  ): Promise<AdvertisementView> {
    return this.advertisementsService.create(principal, payload);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ADVERTISEMENT_UPDATE)
  public update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(advertisementIdSchema, { target: 'params' }))
    advertisementId: string,
    @Body(new ZodValidationPipe(updateAdvertisementSchema, { target: 'body' }))
    payload: UpdateAdvertisementRequest,
  ): Promise<AdvertisementView> {
    return this.advertisementsService.update(principal, advertisementId, payload);
  }
}
