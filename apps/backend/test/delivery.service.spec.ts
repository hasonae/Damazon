import { describe, expect, it, vi } from 'vitest';

import {
  AccountStatusError,
  ConflictError,
  IllegalStateTransitionError,
  ResourceNotFoundError,
} from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { DeliveryService } from '../src/modules/delivery/delivery.service.js';
import { updateDeliveryTaskSchema } from '../src/modules/delivery/dto/delivery.dto.js';
import type { AuthPrincipal } from '../src/security/token.service.js';

const DRIVER: AuthPrincipal = {
  userId: 'driver-user-1',
  sessionId: 'session-1',
  activeRole: 'driver',
  activeBusinessId: null,
  roles: ['driver'],
  adminDepartments: [],
};

const COMPANY: AuthPrincipal = {
  ...DRIVER,
  userId: 'company-owner-1',
  activeRole: 'delivery_company',
  activeBusinessId: 'delivery-business-1',
  roles: ['delivery_company'],
};

function taskRecord(status = 'assigned') {
  return {
    id: 'task-1',
    status,
    pickupLatitude: 33.5,
    pickupLongitude: 36.3,
    deliveryLatitude: 33.51,
    deliveryLongitude: 36.31,
    estimatedArrivalAt: null,
    createdAt: new Date('2026-10-18T00:00:00.000Z'),
    order: {
      id: 'order-1',
      orderNumber: 'DMZ-TEST0001',
      status:
        status === 'assigned'
          ? 'driver_assigned'
          : status === 'arrived_at_destination'
            ? 'arrived'
            : 'driver_accepted',
      totalMinor: 25000,
      currency: 'SYP',
      business: { name: 'Store' },
      customer: { firstName: 'Customer', lastName: 'One', phone: '+963941000001' },
    },
    driver: { id: 'driver-1', user: { firstName: 'Driver', lastName: 'One' } },
  };
}

function createPrismaFake() {
  const transactionClient = {
    userRoleAssignment: { upsert: vi.fn().mockResolvedValue(undefined) },
    deliveryTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    driver: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    orderStatusHistory: { create: vi.fn() },
    payment: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'payment-1',
        status: 'pending',
        amountMinor: 25000,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    paymentLog: { create: vi.fn() },
  };
  const prisma = {
    deliveryCompany: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'company-1',
        businessId: 'delivery-business-1',
        coverageCityIds: ['city-1'],
      }),
    },
    driver: {
      findUnique: vi.fn().mockResolvedValue({ id: 'driver-1', status: 'busy' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'driver-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ status: 'available' }),
    },
    userRoleAssignment: {
      findUnique: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
    },
    deliveryTask: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        id: 'task-1',
        orderId: 'order-1',
        status: 'assigned',
        order: { status: 'driver_assigned' },
      }),
    },
    transaction: vi.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
    ),
  };
  return { prisma: prisma as unknown as PrismaService, raw: prisma, transactionClient };
}

describe('DeliveryService', () => {
  it('requires explicit cash collection confirmation to complete a delivery', () => {
    expect(updateDeliveryTaskSchema.safeParse({ status: 'delivered' }).success).toBe(false);
    expect(
      updateDeliveryTaskSchema.safeParse({ status: 'delivered', cashCollected: true }).success,
    ).toBe(true);
    expect(
      updateDeliveryTaskSchema.safeParse({ status: 'accepted', cashCollected: true }).success,
    ).toBe(false);
  });

  it('limits a driver task list to the authenticated driver', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new DeliveryService(prisma);

    await service.listTasks(DRIVER, {});

    expect(raw.deliveryTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { driverId: 'driver-1' } }),
    );
  });

  it('does not allow a pending driver application to access delivery tasks', async () => {
    const { prisma, raw } = createPrismaFake();
    raw.userRoleAssignment.findUnique.mockResolvedValue({ status: 'PENDING' });
    const service = new DeliveryService(prisma);

    await expect(service.listTasks(DRIVER, {})).rejects.toBeInstanceOf(AccountStatusError);
    expect(raw.deliveryTask.findMany).not.toHaveBeenCalled();
  });

  it('creates a pending driver application without granting driver access', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    raw.userRoleAssignment.findUnique.mockResolvedValueOnce(null);
    const service = new DeliveryService(prisma);
    const customer: AuthPrincipal = {
      ...DRIVER,
      activeRole: 'customer',
      roles: ['customer'],
    };

    const application = await service.applyAsDriver(customer, {
      vehicleType: 'motorcycle',
      vehiclePlateNumber: '12345',
    });

    expect(application).toMatchObject({ status: 'PENDING', vehicleType: 'motorcycle' });
    expect(transactionClient.userRoleAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'driver', status: 'PENDING' }),
      }),
    );
    expect(transactionClient.driver.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          vehicleType: 'motorcycle',
          vehiclePlateNumber: '12345',
          status: 'offline',
        }),
      }),
    );
  });

  it('prevents creating a second driver application while one is already pending', async () => {
    const { prisma, raw } = createPrismaFake();
    raw.userRoleAssignment.findUnique.mockResolvedValue({ status: 'PENDING' });
    const service = new DeliveryService(prisma);

    await expect(
      service.applyAsDriver(
        { ...DRIVER, activeRole: 'customer', roles: ['customer'] },
        { vehicleType: 'motorcycle' },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(raw.transaction).not.toHaveBeenCalled();
  });

  it('does not expose another delivery company or its drivers', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new DeliveryService(prisma);

    await service.listDrivers(COMPANY);

    expect(raw.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1' } }),
    );
    expect(raw.deliveryCompany.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'delivery-business-1',
          business: {
            ownerId: 'company-owner-1',
            status: 'ACTIVE',
            verificationStatus: 'APPROVED',
          },
        }),
      }),
    );
  });

  it('rejects an illegal delivery task transition before writing', async () => {
    const { prisma, raw } = createPrismaFake();
    raw.deliveryTask.findFirst.mockResolvedValue({
      id: 'task-1',
      orderId: 'order-1',
      status: 'assigned',
      order: { status: 'driver_assigned' },
    });
    const service = new DeliveryService(prisma);

    await expect(
      service.updateTaskStatus(DRIVER, 'task-1', { status: 'delivered' }),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
    expect(raw.transaction).not.toHaveBeenCalled();
  });

  it('claims an unassigned task for a company driver and advances the order', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    raw.driver.findFirst.mockResolvedValue({ id: 'driver-1' });
    raw.deliveryTask.findFirst
      .mockResolvedValueOnce({ id: 'task-1', orderId: 'order-1', status: 'unassigned' })
      .mockResolvedValueOnce(taskRecord('assigned'));
    const service = new DeliveryService(prisma);

    const task = await service.assignTask(COMPANY, { taskId: 'task-1', driverId: 'driver-1' });

    expect(task.id).toBe('task-1');
    expect(transactionClient.deliveryTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', companyId: null, status: 'unassigned' },
        data: expect.objectContaining({
          companyId: 'company-1',
          driverId: 'driver-1',
          status: 'assigned',
        }),
      }),
    );
    expect(transactionClient.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'ready' },
      data: { status: 'driver_assigned' },
    });
  });

  it('refuses to assign a driver who is not available in the company', async () => {
    const { prisma, raw } = createPrismaFake();
    raw.driver.findFirst.mockResolvedValue(null);
    const service = new DeliveryService(prisma);

    await expect(
      service.assignTask(COMPANY, { taskId: 'task-1', driverId: 'foreign-driver' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(raw.deliveryTask.findFirst).not.toHaveBeenCalled();
    expect(raw.transaction).not.toHaveBeenCalled();
  });

  it('keeps driver availability busy while they have an active task', async () => {
    const { prisma, raw } = createPrismaFake();
    raw.deliveryTask.findFirst.mockResolvedValue({ id: 'task-1' });
    const service = new DeliveryService(prisma);

    await expect(service.updateAvailability(DRIVER, { status: 'offline' })).rejects.toThrow(
      'cannot be changed while a delivery task is active',
    );
    expect(raw.driver.update).not.toHaveBeenCalled();
  });

  it('records delivery completion and restores the driver availability', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    raw.deliveryTask.findFirst
      .mockResolvedValueOnce({
        id: 'task-1',
        orderId: 'order-1',
        status: 'arrived_at_destination',
        order: { status: 'arrived', totalMinor: 25000 },
      })
      .mockResolvedValueOnce(taskRecord('delivered'));
    const service = new DeliveryService(prisma);

    await service.updateTaskStatus(DRIVER, 'task-1', {
      status: 'delivered',
      cashCollected: true,
    });

    expect(transactionClient.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'arrived' },
      data: {
        status: 'delivered',
        deliveredAt: expect.any(Date),
        paymentStatus: 'succeeded',
      },
    });
    expect(transactionClient.payment.findFirst).toHaveBeenCalledWith({
      where: { orderId: 'order-1', method: 'cash_on_delivery' },
      select: { id: true, status: true, amountMinor: true },
    });
    expect(transactionClient.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'pending' },
      data: { status: 'succeeded', verifiedAt: expect.any(Date) },
    });
    expect(transactionClient.paymentLog.create).toHaveBeenCalledWith({
      data: {
        paymentId: 'payment-1',
        event: 'cash_collected',
        fromStatus: 'pending',
        toStatus: 'succeeded',
        data: {
          driverId: 'driver-1',
          collectedByUserId: 'driver-user-1',
          amountMinor: 25000,
        },
      },
    });
    expect(transactionClient.driver.updateMany).toHaveBeenCalledWith({
      where: { id: 'driver-1', status: 'busy' },
      data: { status: 'available', completedDeliveries: { increment: 1 } },
    });
  });

  it('does not complete delivery when the recorded cash amount differs from the order total', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    raw.deliveryTask.findFirst.mockResolvedValue({
      id: 'task-1',
      orderId: 'order-1',
      status: 'arrived_at_destination',
      order: { status: 'arrived', totalMinor: 25000 },
    });
    transactionClient.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      status: 'pending',
      amountMinor: 24000,
    });
    const service = new DeliveryService(prisma);

    await expect(
      service.updateTaskStatus(DRIVER, 'task-1', {
        status: 'delivered',
        cashCollected: true,
      }),
    ).rejects.toThrow('does not match this order');
    expect(transactionClient.payment.updateMany).not.toHaveBeenCalled();
    expect(transactionClient.order.updateMany).not.toHaveBeenCalled();
  });
});
