import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';

import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import { DeliveryService } from './delivery.service.js';
import {
  assignDeliveryTaskSchema,
  driverApplicationSchema,
  deliveryTaskIdSchema,
  listDeliveryTasksQuerySchema,
  updateDeliveryTaskSchema,
  updateDriverAvailabilitySchema,
  updateDriverLocationSchema,
  type AssignDeliveryTaskRequest,
  type DriverApplicationRequest,
  type DriverApplicationView,
  type DeliveryTaskView,
  type DeliveryDriverView,
  type ListDeliveryTasksQuery,
  type UpdateDeliveryTaskRequest,
  type UpdateDriverAvailabilityRequest,
  type UpdateDriverLocationRequest,
} from './dto/delivery.dto.js';

@Controller('delivery')
export class DeliveryController {
  public constructor(@Inject(DeliveryService) private readonly deliveryService: DeliveryService) {}

  @Get('driver/application')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  public getDriverApplication(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<DriverApplicationView> {
    return this.deliveryService.getDriverApplication(principal);
  }

  @Post('driver/application')
  @RequirePermissions(PERMISSIONS.DRIVER_CREATE)
  public applyAsDriver(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(driverApplicationSchema, { target: 'body' }))
    payload: DriverApplicationRequest,
  ): Promise<DriverApplicationView> {
    return this.deliveryService.applyAsDriver(principal, payload);
  }

  @Get('tasks')
  @RequirePermissions(PERMISSIONS.DELIVERY_READ)
  public listTasks(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(listDeliveryTasksQuerySchema, { target: 'query' }))
    query: ListDeliveryTasksQuery,
  ): Promise<readonly DeliveryTaskView[]> {
    return this.deliveryService.listTasks(principal, query);
  }

  @Get('drivers')
  @RequirePermissions(PERMISSIONS.DRIVER_READ)
  public listDrivers(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<readonly DeliveryDriverView[]> {
    return this.deliveryService.listDrivers(principal);
  }

  @Post('tasks/assign')
  @RequirePermissions(PERMISSIONS.ASSIGNMENT_CREATE)
  public assignTask(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(assignDeliveryTaskSchema, { target: 'body' }))
    payload: AssignDeliveryTaskRequest,
  ): Promise<DeliveryTaskView> {
    return this.deliveryService.assignTask(principal, payload);
  }

  @Patch('tasks/:id/status')
  @RequirePermissions(PERMISSIONS.DELIVERY_UPDATE)
  public updateTaskStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(deliveryTaskIdSchema, { target: 'params' })) taskId: string,
    @Body(new ZodValidationPipe(updateDeliveryTaskSchema, { target: 'body' }))
    payload: UpdateDeliveryTaskRequest,
  ): Promise<DeliveryTaskView> {
    return this.deliveryService.updateTaskStatus(principal, taskId, payload);
  }

  @Patch('driver/availability')
  @RequirePermissions(PERMISSIONS.DRIVER_UPDATE)
  public updateAvailability(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(updateDriverAvailabilitySchema, { target: 'body' }))
    payload: UpdateDriverAvailabilityRequest,
  ): Promise<{ readonly status: string }> {
    return this.deliveryService.updateAvailability(principal, payload);
  }

  @Get('driver/availability')
  @RequirePermissions(PERMISSIONS.DELIVERY_READ)
  public getAvailability(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<{ readonly status: string }> {
    return this.deliveryService.getAvailability(principal);
  }

  @Patch('driver/location')
  @RequirePermissions(PERMISSIONS.DELIVERY_UPDATE)
  public updateLocation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodValidationPipe(updateDriverLocationSchema, { target: 'body' }))
    payload: UpdateDriverLocationRequest,
  ): Promise<{ readonly updatedAt: string }> {
    return this.deliveryService.updateLocation(principal, payload);
  }
}
