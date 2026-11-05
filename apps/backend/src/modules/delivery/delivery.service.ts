import { Inject, Injectable } from '@nestjs/common';
import {
  assertDeliveryTaskTransition,
  assertDriverTransition,
  assertOrderTransition,
  DELIVERY_TASK_STATUSES,
  DRIVER_STATUSES,
  ORDER_ACTORS,
  ORDER_STATUSES,
} from '@damazon/shared-types';
import type { Prisma } from '@prisma/client';

import {
  AccountStatusError,
  BusinessRuleViolationError,
  ConflictError,
  IllegalStateTransitionError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import type {
  AssignDeliveryTaskRequest,
  DeliveryDriverView,
  DeliveryTaskView,
  DriverApplicationRequest,
  DriverApplicationView,
  ListDeliveryTasksQuery,
  UpdateDeliveryTaskRequest,
  UpdateDriverAvailabilityRequest,
  UpdateDriverLocationRequest,
} from './dto/delivery.dto.js';

const DELIVERY_TASK_INCLUDE = {
  order: {
    include: {
      business: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
    },
  },
  driver: {
    include: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

type DeliveryTaskRecord = Prisma.DeliveryTaskGetPayload<{ include: typeof DELIVERY_TASK_INCLUDE }>;

function coordinate(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toView(task: DeliveryTaskRecord): DeliveryTaskView {
  return {
    id: task.id,
    status: task.status,
    order: {
      id: task.order.id,
      orderNumber: task.order.orderNumber,
      status: task.order.status,
      businessName: task.order.business.name,
      customerName: `${task.order.customer.firstName} ${task.order.customer.lastName}`,
      customerPhone: task.order.customer.phone,
      totalMinor: task.order.totalMinor.toString(),
      currency: task.order.currency,
    },
    pickup: {
      latitude: coordinate(task.pickupLatitude),
      longitude: coordinate(task.pickupLongitude),
    },
    destination: {
      latitude: coordinate(task.deliveryLatitude),
      longitude: coordinate(task.deliveryLongitude),
    },
    driver:
      task.driver === null
        ? null
        : {
            id: task.driver.id,
            name: `${task.driver.user.firstName} ${task.driver.user.lastName}`,
          },
    estimatedArrivalAt: task.estimatedArrivalAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

@Injectable()
export class DeliveryService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getDriverApplication(principal: AuthPrincipal): Promise<DriverApplicationView> {
    const [assignment, driver] = await Promise.all([
      this.prisma.userRoleAssignment.findUnique({
        where: { userId_role: { userId: principal.userId, role: 'driver' } },
        select: { status: true },
      }),
      this.prisma.driver.findUnique({
        where: { userId: principal.userId },
        select: { vehicleType: true, vehiclePlateNumber: true },
      }),
    ]);
    return {
      status: assignment?.status ?? null,
      vehicleType: driver?.vehicleType ?? null,
      vehiclePlateNumber: driver?.vehiclePlateNumber ?? null,
    };
  }

  public async applyAsDriver(
    principal: AuthPrincipal,
    payload: DriverApplicationRequest,
  ): Promise<DriverApplicationView> {
    if (principal.activeRole !== 'customer') {
      throw new BusinessRuleViolationError(
        'Driver applications must be submitted from customer mode',
      );
    }
    const existing = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_role: { userId: principal.userId, role: 'driver' } },
      select: { status: true },
    });
    if (existing !== null && existing.status !== 'REJECTED') {
      throw new ConflictError('A driver application already exists for this account');
    }

    await this.prisma.transaction(async (client) => {
      await client.userRoleAssignment.upsert({
        where: { userId_role: { userId: principal.userId, role: 'driver' } },
        create: {
          userId: principal.userId,
          role: 'driver',
          status: 'PENDING',
        },
        update: {
          status: 'PENDING',
          activeBusinessId: null,
          statusReasonCode: null,
          statusNote: null,
          reviewedById: null,
          reviewedAt: null,
        },
      });
      await client.driver.upsert({
        where: { userId: principal.userId },
        create: {
          userId: principal.userId,
          vehicleType: payload.vehicleType,
          vehiclePlateNumber: payload.vehiclePlateNumber ?? null,
          status: DRIVER_STATUSES.OFFLINE,
        },
        update: {
          vehicleType: payload.vehicleType,
          vehiclePlateNumber: payload.vehiclePlateNumber ?? null,
          companyId: null,
          status: DRIVER_STATUSES.OFFLINE,
        },
      });
    });

    return {
      status: 'PENDING',
      vehicleType: payload.vehicleType,
      vehiclePlateNumber: payload.vehiclePlateNumber ?? null,
    };
  }

  public async listDrivers(principal: AuthPrincipal): Promise<readonly DeliveryDriverView[]> {
    const company = await this.resolveCompany(principal);
    const drivers = await this.prisma.driver.findMany({
      where: { companyId: company.id },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return drivers.map((driver) => ({
      id: driver.id,
      name: `${driver.user.firstName} ${driver.user.lastName}`,
      phone: driver.user.phone,
      status: driver.status,
      vehicleType: driver.vehicleType,
      completedDeliveries: driver.completedDeliveries,
    }));
  }

  public async listTasks(
    principal: AuthPrincipal,
    query: ListDeliveryTasksQuery,
  ): Promise<readonly DeliveryTaskView[]> {
    if (principal.activeRole === 'driver') {
      await this.assertDriverRole(principal);
      const driver = await this.prisma.driver.findUnique({
        where: { userId: principal.userId },
        select: { id: true },
      });
      if (driver === null) {
        throw new ResourceNotFoundError('Driver');
      }
      const rows = await this.prisma.deliveryTask.findMany({
        where: { driverId: driver.id, ...(query.status ? { status: query.status } : {}) },
        include: DELIVERY_TASK_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return rows.map(toView);
    }

    const company = await this.resolveCompany(principal);
    const rows = await this.prisma.deliveryTask.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        OR: [
          { companyId: company.id },
          ...(company.coverageCityIds.length > 0
            ? [
                {
                  companyId: null,
                  status: DELIVERY_TASK_STATUSES.UNASSIGNED,
                  order: {
                    status: ORDER_STATUSES.READY,
                    business: { cityId: { in: company.coverageCityIds } },
                  },
                },
              ]
            : []),
        ],
      },
      include: DELIVERY_TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toView);
  }

  public async assignTask(
    principal: AuthPrincipal,
    payload: AssignDeliveryTaskRequest,
  ): Promise<DeliveryTaskView> {
    const company = await this.resolveCompany(principal);
    const driver = await this.prisma.driver.findFirst({
      where: { id: payload.driverId, companyId: company.id, status: DRIVER_STATUSES.AVAILABLE },
      select: { id: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Available driver', payload.driverId);
    }

    const task = await this.prisma.deliveryTask.findFirst({
      where: {
        id: payload.taskId,
        companyId: null,
        status: DELIVERY_TASK_STATUSES.UNASSIGNED,
        order: {
          status: ORDER_STATUSES.READY,
          business: { cityId: { in: company.coverageCityIds } },
        },
      },
      select: { id: true, orderId: true, status: true },
    });
    if (task === null) {
      throw new ResourceNotFoundError('Available delivery task', payload.taskId);
    }

    try {
      assertDeliveryTaskTransition(task.status, DELIVERY_TASK_STATUSES.OFFERED);
      assertDeliveryTaskTransition(DELIVERY_TASK_STATUSES.OFFERED, DELIVERY_TASK_STATUSES.ASSIGNED);
      assertOrderTransition(
        ORDER_STATUSES.READY,
        ORDER_STATUSES.DRIVER_ASSIGNED,
        ORDER_ACTORS.DELIVERY_COMPANY,
      );
    } catch {
      throw new IllegalStateTransitionError(
        'Delivery task',
        task.status,
        DELIVERY_TASK_STATUSES.ASSIGNED,
      );
    }

    await this.prisma.transaction(async (client) => {
      const claimed = await client.deliveryTask.updateMany({
        where: {
          id: task.id,
          companyId: null,
          status: DELIVERY_TASK_STATUSES.UNASSIGNED,
        },
        data: {
          companyId: company.id,
          driverId: driver.id,
          status: DELIVERY_TASK_STATUSES.ASSIGNED,
          assignedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new BusinessRuleViolationError('This delivery task has already been assigned');
      }
      const madeBusy = await client.driver.updateMany({
        where: { id: driver.id, companyId: company.id, status: DRIVER_STATUSES.AVAILABLE },
        data: { status: DRIVER_STATUSES.BUSY },
      });
      if (madeBusy.count !== 1) {
        throw new BusinessRuleViolationError('This driver is no longer available');
      }
      const updatedOrder = await client.order.updateMany({
        where: { id: task.orderId, status: ORDER_STATUSES.READY },
        data: { status: ORDER_STATUSES.DRIVER_ASSIGNED },
      });
      if (updatedOrder.count !== 1) {
        throw new BusinessRuleViolationError('The order is no longer ready for delivery');
      }
      await client.orderStatusHistory.create({
        data: {
          orderId: task.orderId,
          fromStatus: ORDER_STATUSES.READY,
          toStatus: ORDER_STATUSES.DRIVER_ASSIGNED,
          actorType: ORDER_ACTORS.DELIVERY_COMPANY,
          actorId: principal.userId,
        },
      });
    });

    return this.getTaskForDriver(principal.userId, task.id);
  }

  public async updateTaskStatus(
    principal: AuthPrincipal,
    taskId: string,
    payload: UpdateDeliveryTaskRequest,
  ): Promise<DeliveryTaskView> {
    await this.assertDriverRole(principal);
    const driver = await this.prisma.driver.findUnique({
      where: { userId: principal.userId },
      select: { id: true, status: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver');
    }

    const task = await this.prisma.deliveryTask.findFirst({
      where: { id: taskId, driverId: driver.id },
      select: {
        id: true,
        orderId: true,
        status: true,
        order: { select: { status: true, totalMinor: true } },
      },
    });
    if (task === null) {
      throw new ResourceNotFoundError('Delivery task', taskId);
    }

    try {
      assertDeliveryTaskTransition(task.status, payload.status);
    } catch {
      throw new IllegalStateTransitionError('Delivery task', task.status, payload.status);
    }

    const nextOrderStatus =
      payload.status === DELIVERY_TASK_STATUSES.ACCEPTED
        ? ORDER_STATUSES.DRIVER_ACCEPTED
        : payload.status === DELIVERY_TASK_STATUSES.IN_TRANSIT
          ? ORDER_STATUSES.ON_THE_WAY
          : payload.status === DELIVERY_TASK_STATUSES.ARRIVED_AT_DESTINATION
            ? ORDER_STATUSES.ARRIVED
            : payload.status === DELIVERY_TASK_STATUSES.DELIVERED
              ? ORDER_STATUSES.DELIVERED
              : null;

    if (nextOrderStatus !== null) {
      try {
        assertOrderTransition(task.order.status, nextOrderStatus, ORDER_ACTORS.DRIVER);
      } catch {
        throw new IllegalStateTransitionError('Order', task.order.status, nextOrderStatus);
      }
    }

    await this.prisma.transaction(async (client) => {
      const updatedTask = await client.deliveryTask.updateMany({
        where: { id: task.id, driverId: driver.id, status: task.status },
        data: {
          status: payload.status,
          ...(payload.status === DELIVERY_TASK_STATUSES.ACCEPTED ? { acceptedAt: new Date() } : {}),
          ...(payload.status === DELIVERY_TASK_STATUSES.PICKED_UP
            ? { pickedUpAt: new Date() }
            : {}),
          ...(payload.status === DELIVERY_TASK_STATUSES.DELIVERED
            ? { completedAt: new Date() }
            : {}),
        },
      });
      if (updatedTask.count !== 1) {
        throw new BusinessRuleViolationError('This delivery task has already changed');
      }
      if (nextOrderStatus !== null) {
        const now = new Date();
        if (payload.status === DELIVERY_TASK_STATUSES.DELIVERED) {
          const payment = await client.payment.findFirst({
            where: { orderId: task.orderId, method: 'cash_on_delivery' },
            select: { id: true, status: true, amountMinor: true },
          });
          if (
            payment === null ||
            payment.status !== 'pending' ||
            payment.amountMinor !== task.order.totalMinor
          ) {
            throw new BusinessRuleViolationError(
              'The pending cash-on-delivery payment does not match this order',
            );
          }

          const collected = await client.payment.updateMany({
            where: { id: payment.id, status: 'pending' },
            data: { status: 'succeeded', verifiedAt: now },
          });
          if (collected.count !== 1) {
            throw new BusinessRuleViolationError('This payment has already been reconciled');
          }
          await client.paymentLog.create({
            data: {
              paymentId: payment.id,
              event: 'cash_collected',
              fromStatus: payment.status,
              toStatus: 'succeeded',
              data: {
                driverId: driver.id,
                collectedByUserId: principal.userId,
                amountMinor: payment.amountMinor,
              },
            },
          });
        }

        const updatedOrder = await client.order.updateMany({
          where: { id: task.orderId, status: task.order.status },
          data: {
            status: nextOrderStatus,
            ...(nextOrderStatus === ORDER_STATUSES.DELIVERED
              ? { deliveredAt: now, paymentStatus: 'succeeded' }
              : {}),
          },
        });
        if (updatedOrder.count !== 1) {
          throw new BusinessRuleViolationError('The order has already changed');
        }
        await client.orderStatusHistory.create({
          data: {
            orderId: task.orderId,
            fromStatus: task.order.status,
            toStatus: nextOrderStatus,
            actorType: ORDER_ACTORS.DRIVER,
            actorId: principal.userId,
          },
        });
      }
      if (payload.status === DELIVERY_TASK_STATUSES.DELIVERED) {
        await client.driver.updateMany({
          where: { id: driver.id, status: DRIVER_STATUSES.BUSY },
          data: {
            status: DRIVER_STATUSES.AVAILABLE,
            completedDeliveries: { increment: 1 },
          },
        });
      }
    });

    return this.getTaskForDriver(principal.userId, task.id);
  }

  public async updateAvailability(
    principal: AuthPrincipal,
    payload: UpdateDriverAvailabilityRequest,
  ): Promise<{ readonly status: string }> {
    await this.assertDriverRole(principal);
    const driver = await this.prisma.driver.findUnique({
      where: { userId: principal.userId },
      select: { id: true, status: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver');
    }
    const activeTask = await this.prisma.deliveryTask.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            DELIVERY_TASK_STATUSES.ASSIGNED,
            DELIVERY_TASK_STATUSES.ACCEPTED,
            DELIVERY_TASK_STATUSES.PICKED_UP,
            DELIVERY_TASK_STATUSES.IN_TRANSIT,
            DELIVERY_TASK_STATUSES.ARRIVED_AT_DESTINATION,
          ],
        },
      },
      select: { id: true },
    });
    if (activeTask !== null) {
      throw new BusinessRuleViolationError(
        'Driver availability cannot be changed while a delivery task is active',
      );
    }
    try {
      assertDriverTransition(driver.status, payload.status);
    } catch {
      throw new IllegalStateTransitionError('Driver', driver.status, payload.status);
    }
    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: { status: payload.status },
      select: { status: true },
    });
    return updated;
  }

  public async getAvailability(principal: AuthPrincipal): Promise<{ readonly status: string }> {
    await this.assertDriverRole(principal);
    const driver = await this.prisma.driver.findUnique({
      where: { userId: principal.userId },
      select: { status: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver');
    }
    return driver;
  }

  public async updateLocation(
    principal: AuthPrincipal,
    payload: UpdateDriverLocationRequest,
  ): Promise<{ readonly updatedAt: string }> {
    await this.assertDriverRole(principal);
    const driver = await this.prisma.driver.findUnique({
      where: { userId: principal.userId },
      select: { id: true },
    });
    if (driver === null) {
      throw new ResourceNotFoundError('Driver');
    }
    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        lastLatitude: payload.latitude,
        lastLongitude: payload.longitude,
        lastLocationAt: new Date(),
      },
      select: { lastLocationAt: true },
    });
    return { updatedAt: (updated.lastLocationAt ?? new Date()).toISOString() };
  }

  private async resolveCompany(principal: AuthPrincipal) {
    if (principal.activeRole !== 'delivery_company') {
      throw new BusinessRuleViolationError('Switch to the delivery company role first');
    }
    if (principal.activeBusinessId === null) {
      throw new BusinessRuleViolationError('Select an active delivery company first');
    }
    const company = await this.prisma.deliveryCompany.findFirst({
      where: {
        businessId: principal.activeBusinessId,
        isOperational: true,
        business: {
          ownerId: principal.userId,
          status: 'ACTIVE',
          verificationStatus: 'APPROVED',
        },
      },
    });
    if (company === null) {
      throw new ResourceNotFoundError('Operational delivery company');
    }
    return company;
  }

  private async assertDriverRole(principal: AuthPrincipal): Promise<void> {
    if (principal.activeRole !== 'driver') {
      throw new BusinessRuleViolationError('Switch to the driver role first');
    }
    const assignment = await this.prisma.userRoleAssignment.findUnique({
      where: { userId_role: { userId: principal.userId, role: 'driver' } },
      select: { status: true },
    });
    if (assignment?.status !== 'APPROVED') {
      throw new AccountStatusError(`driver:${assignment?.status ?? 'MISSING'}`);
    }
  }

  private async getTaskForDriver(userId: string, taskId: string): Promise<DeliveryTaskView> {
    const task = await this.prisma.deliveryTask.findFirst({
      where: { id: taskId, driver: { userId } },
      include: DELIVERY_TASK_INCLUDE,
    });
    if (task === null) {
      throw new ResourceNotFoundError('Delivery task', taskId);
    }
    return toView(task);
  }
}
