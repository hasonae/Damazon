import { describe, expect, it, vi } from 'vitest';

import { IllegalStateTransitionError } from '../src/common/errors/domain.error.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { createOrderSchema, type OrderDetail } from '../src/modules/orders/dto/orders.dto.js';
import type { AuthPrincipal } from '../src/security/token.service.js';

const PRINCIPAL: AuthPrincipal = {
  userId: 'owner-1',
  sessionId: 'session-1',
  activeRole: 'merchant',
  activeBusinessId: 'business-1',
  roles: ['merchant'],
  adminDepartments: [],
};

function orderDetail(): OrderDetail {
  return {
    id: 'order-1',
    orderNumber: 'DMZ-20261018-TEST0001',
    status: 'preparing',
    paymentStatus: 'pending',
    paymentMethod: 'cash_on_delivery',
    business: { id: 'business-1', name: 'Store', logoUrl: null },
    itemCount: 1,
    subtotalMinor: '12000',
    deliveryFeeMinor: '0',
    totalMinor: '12000',
    currency: 'SYP',
    destinationKind: 'damazon_zone',
    createdAt: '2026-10-18T00:00:00.000Z',
    placedAt: null,
    items: [],
    history: [],
    customerNote: null,
    deliveryInstructions: null,
    deliveryZone: null,
    recipientName: null,
    recipientPhone: null,
    cancellationReason: null,
    estimatedDeliveryAt: null,
  };
}

function createPrismaFake(orderStatus = 'confirmed') {
  const transactionClient = {
    order: { update: vi.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    deliveryTask: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    business: { findFirst: vi.fn().mockResolvedValue({ id: 'business-1' }) },
    order: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'order-1',
        status: orderStatus,
        business: { latitude: 33.5, longitude: 36.3 },
        deliveryLatitude: 33.51,
        deliveryLongitude: 36.31,
        deliveryZoneId: 'zone-1',
        destinationKind: 'home_address',
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    transaction: vi.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
    ),
  };
  return { prisma: prisma as unknown as PrismaService, transactionClient, raw: prisma };
}

describe('OrdersService business operations', () => {
  it('allows only cash on delivery in the checkout contract', () => {
    expect(
      createOrderSchema.safeParse({
        destinationKind: 'pickup',
        paymentMethod: 'cash_on_delivery',
      }).success,
    ).toBe(true);
    for (const paymentMethod of ['sham_cash', 'qr_payment']) {
      expect(
        createOrderSchema.safeParse({ destinationKind: 'pickup', paymentMethod }).success,
      ).toBe(false);
    }
  });

  it('lists only orders for the active business after verifying ownership', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new OrdersService(prisma);

    const page = await service.listBusinessOrders(PRINCIPAL, { limit: 20 });

    expect(page.items).toEqual([]);
    expect(raw.business.findFirst).toHaveBeenCalledWith({
      where: { id: 'business-1', ownerId: 'owner-1' },
      select: { id: true },
    });
    expect(raw.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'business-1' } }),
    );
  });

  it('records permitted seller status transitions against the active tenant', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    const service = new OrdersService(prisma);
    vi.spyOn(service, 'getOrder').mockResolvedValue(orderDetail());

    await service.updateBusinessOrderStatus(PRINCIPAL, 'order-1', { status: 'preparing' });

    expect(raw.order.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        businessId: 'business-1',
        business: { ownerId: 'owner-1' },
      },
      select: {
        id: true,
        status: true,
        business: { select: { latitude: true, longitude: true } },
        deliveryLatitude: true,
        deliveryLongitude: true,
        deliveryZoneId: true,
        destinationKind: true,
      },
    });
    expect(transactionClient.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'preparing' },
    });
    expect(transactionClient.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        fromStatus: 'confirmed',
        toStatus: 'preparing',
        actorType: 'seller',
        actorId: 'owner-1',
      },
    });
  });

  it('rejects seller transitions that are not allowed by the shared order lifecycle', async () => {
    const { prisma, raw, transactionClient } = createPrismaFake();
    const service = new OrdersService(prisma);

    await expect(
      service.updateBusinessOrderStatus(PRINCIPAL, 'order-1', { status: 'ready' }),
    ).rejects.toBeInstanceOf(IllegalStateTransitionError);
    expect(raw.transaction).not.toHaveBeenCalled();
    expect(transactionClient.order.update).not.toHaveBeenCalled();
  });

  it('creates a delivery task once the seller marks an order ready', async () => {
    const { prisma, transactionClient } = createPrismaFake('preparing');
    const service = new OrdersService(prisma);
    vi.spyOn(service, 'getOrder').mockResolvedValue(orderDetail());

    await service.updateBusinessOrderStatus(PRINCIPAL, 'order-1', { status: 'ready' });

    expect(transactionClient.deliveryTask.upsert).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      create: {
        orderId: 'order-1',
        status: 'unassigned',
        assignmentMode: 'automatic',
        pickupLatitude: 33.5,
        pickupLongitude: 36.3,
        deliveryLatitude: 33.51,
        deliveryLongitude: 36.31,
      },
      update: {},
    });
  });

  it('requires an active business in the authenticated session', async () => {
    const { prisma, raw } = createPrismaFake();
    const service = new OrdersService(prisma);

    await expect(
      service.listBusinessOrders({ ...PRINCIPAL, activeBusinessId: null }, { limit: 20 }),
    ).rejects.toThrow('Select an active business');
    expect(raw.business.findFirst).not.toHaveBeenCalled();
    expect(raw.order.findMany).not.toHaveBeenCalled();
  });
});
