import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@damazon/shared-types';
import { z } from 'zod';

import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { PaginatedResult } from '@damazon/shared-types';
import { listOrdersQuerySchema, type ListOrdersQuery } from '../orders/dto/orders.dto.js';
import type {
  AdminBusinessReviewView,
  AdminDashboardView,
  AdminOrderView,
} from './dto/admin.dto.js';
import {
  adminBusinessIdSchema,
  cashSubscriptionConfirmationSchema,
  approveDriverApplicationSchema,
  listAuditLogsQuerySchema,
  rejectDriverApplicationSchema,
  rejectBusinessSchema,
  updateDriverStatusSchema,
  updateUserStatusSchema,
  type CashSubscriptionConfirmationRequest,
  type ApproveDriverApplicationRequest,
  type ListAuditLogsQuery,
  type RejectBusinessRequest,
  type RejectDriverApplicationRequest,
  type UpdateDriverStatusRequest,
  type UpdateUserStatusRequest,
} from './dto/admin.dto.js';
import { AdminService } from './admin.service.js';
import type { AuthPrincipal } from '../../security/token.service.js';

@Controller('admin')
export class AdminController {
  public constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.ORDER_READ, PERMISSIONS.BUSINESS_READ)
  public dashboard(): Promise<AdminDashboardView> {
    return this.adminService.dashboard();
  }

  @Get('orders')
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  public listOrders(
    @Query(new ZodValidationPipe(listOrdersQuerySchema, { target: 'query' }))
    query: ListOrdersQuery,
  ): Promise<PaginatedResult<AdminOrderView>> {
    return this.adminService.listOrders(query);
  }

  @Get('businesses/review')
  @RequirePermissions(PERMISSIONS.BUSINESS_READ)
  public listBusinessesForReview(): Promise<readonly AdminBusinessReviewView[]> {
    return this.adminService.listBusinessesForReview();
  }

  @Post('businesses/:id/approve')
  @RequirePermissions(PERMISSIONS.BUSINESS_APPROVE)
  public approveBusiness(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    businessId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.approveBusiness(businessId, principal.userId);
  }

  @Post('businesses/:id/reject')
  @RequirePermissions(PERMISSIONS.BUSINESS_APPROVE)
  public rejectBusiness(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    businessId: string,
    @Body(new ZodValidationPipe(rejectBusinessSchema, { target: 'body' }))
    payload: RejectBusinessRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.rejectBusiness(businessId, principal.userId, payload.reason);
  }

  @Post('businesses/:id/cash-subscription')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTION_MANAGE, PERMISSIONS.INVOICE_MANAGE)
  public confirmCashSubscription(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    businessId: string,
    @Body(new ZodValidationPipe(cashSubscriptionConfirmationSchema, { target: 'body' }))
    payload: CashSubscriptionConfirmationRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.confirmCashSubscription(businessId, principal.userId, payload.note);
  }

  @Get('users')
  @RequirePermissions(PERMISSIONS.USER_READ)
  public listUsers(
    @Query(
      new ZodValidationPipe(
        z.object({
          limit: z.coerce.number().int().min(1).max(100).default(25),
          cursor: z.string().min(1).max(512).optional(),
        }),
        { target: 'query' },
      ),
    )
    query: {
      limit: number;
      cursor: string | undefined;
    },
  ): Promise<{
    readonly items: readonly import('./dto/admin.dto.js').AdminUserView[];
    readonly meta: {
      readonly limit: number;
      readonly hasMore: boolean;
      readonly nextCursor: string | null;
      readonly totalCount: number;
    };
  }> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  public updateUserStatus(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    userId: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema, { target: 'body' }))
    payload: UpdateUserStatusRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.updateUserStatus(userId, principal.userId, payload.status);
  }

  @Get('drivers')
  @RequirePermissions(PERMISSIONS.DRIVER_READ)
  public listDrivers(): Promise<readonly import('./dto/admin.dto.js').AdminDriverView[]> {
    return this.adminService.listDrivers();
  }

  @Patch('drivers/:id/status')
  @RequirePermissions(PERMISSIONS.DRIVER_UPDATE)
  public updateDriverStatus(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    driverId: string,
    @Body(new ZodValidationPipe(updateDriverStatusSchema, { target: 'body' }))
    payload: UpdateDriverStatusRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.updateDriverStatus(driverId, principal.userId, payload.status);
  }

  @Post('drivers/:id/approve')
  @RequirePermissions(PERMISSIONS.DRIVER_UPDATE)
  public approveDriverApplication(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    driverId: string,
    @Body(new ZodValidationPipe(approveDriverApplicationSchema, { target: 'body' }))
    payload: ApproveDriverApplicationRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.approveDriverApplication(
      driverId,
      principal.userId,
      payload.companyBusinessId,
    );
  }

  @Post('drivers/:id/reject')
  @RequirePermissions(PERMISSIONS.DRIVER_UPDATE)
  public rejectDriverApplication(
    @Param('id', new ZodValidationPipe(adminBusinessIdSchema, { target: 'params' }))
    driverId: string,
    @Body(new ZodValidationPipe(rejectDriverApplicationSchema, { target: 'body' }))
    payload: RejectDriverApplicationRequest,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    return this.adminService.rejectDriverApplication(driverId, principal.userId, payload.reason);
  }

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  public listAuditLogs(
    @Query(new ZodValidationPipe(listAuditLogsQuerySchema, { target: 'query' }))
    query: ListAuditLogsQuery,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<{
    readonly items: readonly import('./dto/admin.dto.js').AdminAuditLogView[];
    readonly meta: {
      readonly limit: number;
      readonly hasMore: boolean;
      readonly nextCursor: string | null;
      readonly totalCount: number;
    };
  }> {
    return this.adminService.listAuditLogs(query, principal.userId);
  }
}
