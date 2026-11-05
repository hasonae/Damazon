import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';

import {
  CurrentPrincipal,
  CurrentUserId,
} from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import { OrdersService } from './orders.service.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateSellerOrderStatusSchema,
  type CancelOrderRequest,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type ListOrdersQuery,
  type OrderDetail,
  type OrderSummary,
  type UpdateSellerOrderStatusRequest,
} from './dto/orders.dto.js';
import type { PaginatedResult } from '@damazon/shared-types';

@Controller('orders')
export class OrdersController {
  public constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ORDER_CREATE)
  public createOrder(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createOrderSchema, { target: 'body' }))
    payload: CreateOrderRequest,
  ): Promise<CreateOrderResponse> {
    return this.ordersService.createOrder(userId, payload);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  public listOrders(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(listOrdersQuerySchema, { target: 'query' }))
    query: ListOrdersQuery,
  ): Promise<PaginatedResult<OrderSummary>> {
    return this.ordersService.listOrders(userId, query);
  }

  @Get('business')
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  public listBusinessOrders(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(listOrdersQuerySchema, { target: 'query' }))
    query: ListOrdersQuery,
  ): Promise<PaginatedResult<OrderSummary>> {
    return this.ordersService.listBusinessOrders(principal, query);
  }

  @Post('business/:id/status')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  public updateBusinessOrderStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(orderIdParamSchema, { target: 'params' })) id: string,
    @Body(new ZodValidationPipe(updateSellerOrderStatusSchema, { target: 'body' }))
    payload: UpdateSellerOrderStatusRequest,
  ): Promise<OrderDetail> {
    return this.ordersService.updateBusinessOrderStatus(principal, id, payload);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  public getOrder(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(orderIdParamSchema, { target: 'params' })) id: string,
  ): Promise<OrderDetail> {
    return this.ordersService.getOrder(userId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDER_CANCEL)
  public cancelOrder(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(orderIdParamSchema, { target: 'params' })) id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema, { target: 'body' }))
    payload: CancelOrderRequest,
  ): Promise<OrderDetail> {
    return this.ordersService.cancelOrder(userId, id, payload);
  }

  @Get(':id/tracking')
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  public trackOrder(
    @CurrentUserId() userId: string,
    @Param('id', new ZodValidationPipe(orderIdParamSchema, { target: 'params' })) id: string,
  ): Promise<{
    readonly orderId: string;
    readonly orderNumber: string;
    readonly orderStatus: string;
    readonly deliveryTaskStatus: string | null;
    readonly driver: { readonly id: string; readonly name: string; readonly phone: string } | null;
    readonly driverLocation: {
      readonly latitude: number;
      readonly longitude: number;
      readonly updatedAt: Date;
    } | null;
    readonly pickup: {
      readonly latitude: number | null;
      readonly longitude: number | null;
    } | null;
    readonly destination: {
      readonly latitude: number | null;
      readonly longitude: number | null;
    } | null;
    readonly estimatedArrivalAt: Date | null;
    readonly deliveredAt: Date | null;
  }> {
    return this.ordersService.getOrderTracking(userId, id);
  }
}
