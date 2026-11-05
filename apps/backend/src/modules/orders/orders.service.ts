import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertOrderTransition,
  buildPage,
  decodeCursor,
  encodeCursor,
  ORDER_ACTORS,
  ORDER_STATUSES,
  type PaginatedResult,
} from '@damazon/shared-types';
import type { AuthPrincipal } from '../../security/token.service.js';

import {
  BusinessRuleViolationError,
  IllegalStateTransitionError,
  OutOfStockError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import { publicBusinessFilter } from '../catalog/catalog.mapper.js';
import { cartInclude, evaluate, variantRowSelect, type VariantRow } from '../cart/cart.shared.js';
import type {
  CancelOrderRequest,
  CreateOrderRequest,
  CreateOrderResponse,
  ListOrdersQuery,
  OrderDetail,
  OrderStatusEvent,
  OrderSummary,
  UpdateSellerOrderStatusRequest,
} from './dto/orders.dto.js';

function generateOrderNumber(now: Date): string {
  const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `DMZ-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

interface DestinationRecord {
  readonly zoneId: string | null;
  readonly addressId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

interface PreparedLine {
  readonly cartItemId: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly trackInventory: boolean;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly imageUrl: string | null;
}

interface PreparedGroup {
  readonly businessId: string;
  readonly lines: PreparedLine[];
  readonly subtotalMinor: number;
}

@Injectable()
export class OrdersService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Checkout. The whole cart is validated against live inventory and pricing
   * first, then one order is created per business inside a single transaction
   * so a multi-store cart either fully succeeds or leaves no trace.
   */
  public async createOrder(
    userId: string,
    payload: CreateOrderRequest,
  ): Promise<CreateOrderResponse> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    if (cart === null || cart.items.length === 0) {
      throw new BusinessRuleViolationError('Your cart is empty');
    }

    const destination = await this.resolveDestination(userId, payload);

    const variantIds = cart.items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== null);
    const variants = await this.loadVariants(variantIds);
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    const groups = new Map<string, PreparedLine[]>();
    for (const item of cart.items) {
      const variant = item.variantId === null ? null : (variantsById.get(item.variantId) ?? null);
      const evaluation = evaluate(item.product, variant);
      const displayName = item.product.nameAr;

      if (item.product.status !== 'active' || !item.product.isAvailable) {
        throw new BusinessRuleViolationError(`${displayName} is no longer available`);
      }
      if (!evaluation.isPurchasable) {
        throw new BusinessRuleViolationError(`${displayName} cannot be purchased right now`);
      }
      if (item.product.trackInventory && item.quantity > evaluation.stockQuantity) {
        throw new OutOfStockError(displayName, item.quantity, evaluation.stockQuantity);
      }

      const lines = groups.get(item.product.business.id) ?? [];
      lines.push({
        cartItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceMinor: evaluation.unitPriceMinor,
        trackInventory: item.product.trackInventory,
        nameAr: item.product.nameAr,
        nameEn: item.product.nameEn,
        imageUrl: item.product.images[0]?.imageUrl ?? null,
      });
      groups.set(item.product.business.id, lines);
    }

    const businessIds = [...groups.keys()];
    const businesses = await this.prisma.business.findMany({
      where: { id: { in: businessIds }, ...publicBusinessFilter() },
      select: { id: true },
    });
    if (businesses.length !== businessIds.length) {
      throw new BusinessRuleViolationError(
        'One or more stores in your cart are not accepting orders right now',
      );
    }

    const prepared: PreparedGroup[] = [...groups.entries()].map(([businessId, lines]) => ({
      businessId,
      lines,
      subtotalMinor: lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0),
    }));

    const now = new Date();
    const summaries = await this.prisma.transaction(async (client) => {
      const created: OrderSummary[] = [];
      for (const group of prepared) {
        created.push(
          await this.persistGroup(client, {
            userId,
            payload,
            destination,
            group,
            now,
          }),
        );
      }
      await client.cartItem.deleteMany({
        where: { id: { in: prepared.flatMap((group) => group.lines.map((l) => l.cartItemId)) } },
      });
      return created;
    });

    return { orders: summaries };
  }

  public async listOrders(
    userId: string,
    query: ListOrdersQuery,
  ): Promise<PaginatedResult<OrderSummary>> {
    const where: Prisma.OrderWhereInput = { customerId: userId };
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const keysetWhere: Prisma.OrderWhereInput = { ...where };
    if (query.cursor !== undefined) {
      try {
        const { createdAt, id } = decodeCursor(query.cursor);
        keysetWhere.AND = [
          { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] },
        ];
      } catch {
        // A malformed cursor restarts the list instead of failing the page.
      }
    }

    const rows = await this.prisma.order.findMany({
      where: keysetWhere,
      include: orderListInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const totalItems = await this.prisma.order.count({ where });
    const last = page[page.length - 1];

    return buildPage(
      page.map(toOrderSummary),
      query.limit,
      hasMore,
      hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
      totalItems,
    );
  }

  public async listBusinessOrders(
    principal: AuthPrincipal,
    query: ListOrdersQuery,
  ): Promise<PaginatedResult<OrderSummary>> {
    const businessId = principal.activeBusinessId;
    if (businessId === null) {
      throw new BusinessRuleViolationError('Select an active business before viewing its orders');
    }

    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: principal.userId },
      select: { id: true },
    });
    if (business === null) {
      throw new ResourceNotFoundError('Business');
    }

    const where: Prisma.OrderWhereInput = { businessId: business.id };
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const keysetWhere: Prisma.OrderWhereInput = { ...where };
    if (query.cursor !== undefined) {
      try {
        const { createdAt, id } = decodeCursor(query.cursor);
        keysetWhere.AND = [
          { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] },
        ];
      } catch {
        // A malformed cursor restarts the list instead of failing the page.
      }
    }

    const rows = await this.prisma.order.findMany({
      where: keysetWhere,
      include: orderListInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const totalItems = await this.prisma.order.count({ where });
    const last = page[page.length - 1];

    return buildPage(
      page.map(toOrderSummary),
      query.limit,
      hasMore,
      hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
      totalItems,
    );
  }

  public async updateBusinessOrderStatus(
    principal: AuthPrincipal,
    orderId: string,
    payload: UpdateSellerOrderStatusRequest,
  ): Promise<OrderDetail> {
    const businessId = principal.activeBusinessId;
    if (businessId === null) {
      throw new BusinessRuleViolationError('Select an active business before updating orders');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        businessId,
        business: { ownerId: principal.userId },
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
    if (order === null) {
      throw new ResourceNotFoundError('Order', orderId);
    }

    try {
      assertOrderTransition(order.status, payload.status, ORDER_ACTORS.SELLER);
    } catch {
      throw new IllegalStateTransitionError('Order', order.status, payload.status);
    }

    await this.prisma.transaction(async (client) => {
      await client.order.update({
        where: { id: order.id },
        data: { status: payload.status },
      });
      await client.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: payload.status,
          actorType: ORDER_ACTORS.SELLER,
          actorId: principal.userId,
        },
      });
      if (payload.status === ORDER_STATUSES.READY && order.destinationKind !== 'pickup') {
        await client.deliveryTask.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            status: 'unassigned',
            assignmentMode: 'automatic',
            pickupLatitude: order.business.latitude,
            pickupLongitude: order.business.longitude,
            deliveryLatitude: order.deliveryLatitude,
            deliveryLongitude: order.deliveryLongitude,
          },
          update: {},
        });
      }
    });

    return this.getOrder(principal.userId, orderId);
  }

  public async getOrder(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ customerId: userId }, { business: { ownerId: userId } }],
      },
      include: {
        ...orderListInclude,
        items: { orderBy: { id: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        deliveryZone: { select: { id: true, name: true } },
      },
    });
    if (order === null) {
      throw new ResourceNotFoundError('Order', orderId);
    }
    return toOrderDetail(order);
  }

  public async getOrderTracking(
    userId: string,
    orderId: string,
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
    readonly pickup: { readonly latitude: number | null; readonly longitude: number | null } | null;
    readonly destination: {
      readonly latitude: number | null;
      readonly longitude: number | null;
    } | null;
    readonly estimatedArrivalAt: Date | null;
    readonly deliveredAt: Date | null;
  }> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: userId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveredAt: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        deliveryTask: {
          select: {
            id: true,
            status: true,
            estimatedArrivalAt: true,
            pickupLatitude: true,
            pickupLongitude: true,
            deliveryLatitude: true,
            deliveryLongitude: true,
            driver: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
                lastLatitude: true,
                lastLongitude: true,
                lastLocationAt: true,
              },
            },
          },
        },
      },
    });
    if (order === null) {
      throw new ResourceNotFoundError('Order', orderId);
    }

    const driver = order.deliveryTask?.driver ?? null;
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      deliveryTaskStatus: order.deliveryTask?.status ?? null,
      driver:
        driver === null
          ? null
          : {
              id: driver.id,
              name: `${driver.user.firstName} ${driver.user.lastName}`,
              phone: driver.user.phone,
            },
      driverLocation:
        driver === null || driver.lastLatitude === null || driver.lastLongitude === null
          ? null
          : {
              latitude: Number(driver.lastLatitude),
              longitude: Number(driver.lastLongitude),
              updatedAt: driver.lastLocationAt ?? new Date(),
            },
      pickup:
        order.deliveryTask === null ||
        order.deliveryTask.pickupLatitude === null ||
        order.deliveryTask.pickupLongitude === null
          ? null
          : {
              latitude: Number(order.deliveryTask.pickupLatitude),
              longitude: Number(order.deliveryTask.pickupLongitude),
            },
      destination:
        order.deliveryLatitude === null || order.deliveryLongitude === null
          ? null
          : {
              latitude: Number(order.deliveryLatitude),
              longitude: Number(order.deliveryLongitude),
            },
      estimatedArrivalAt: order.deliveryTask?.estimatedArrivalAt ?? null,
      deliveredAt: order.deliveredAt,
    };
  }

  public async cancelOrder(
    userId: string,
    orderId: string,
    payload: CancelOrderRequest,
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      select: { id: true, status: true },
    });
    if (order === null) {
      throw new ResourceNotFoundError('Order', orderId);
    }

    try {
      assertOrderTransition(order.status, ORDER_STATUSES.CANCELLED, ORDER_ACTORS.CUSTOMER);
    } catch {
      throw new IllegalStateTransitionError('Order', order.status, ORDER_STATUSES.CANCELLED);
    }

    await this.prisma.transaction(async (client) => {
      await client.order.update({
        where: { id: order.id },
        data: {
          status: ORDER_STATUSES.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: payload.reason,
        },
      });
      await client.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: ORDER_STATUSES.CANCELLED,
          actorType: ORDER_ACTORS.CUSTOMER,
          actorId: userId,
          note: payload.reason,
        },
      });
      // The order already reserved stock at creation; a customer cancellation
      // must put it back or the last unit silently disappears from the shelf.
      const items = await client.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        if (item.productId === null) {
          continue;
        }
        if (item.variantId !== null) {
          await client.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        } else {
          await client.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
          const product = await client.product.findUniqueOrThrow({
            where: { id: item.productId },
            select: { stockQuantity: true },
          });
          await client.inventoryMovement.create({
            data: {
              productId: item.productId,
              operation: 'return',
              quantity: item.quantity,
              balanceAfter: product.stockQuantity,
              referenceType: 'order',
              referenceId: order.id,
              note: 'Order cancelled by customer',
              actorId: userId,
            },
          });
        }
      }
    });

    return this.getOrder(userId, orderId);
  }

  private async resolveDestination(
    userId: string,
    payload: CreateOrderRequest,
  ): Promise<DestinationRecord> {
    if (payload.destinationKind === 'pickup') {
      return { zoneId: null, addressId: null, latitude: null, longitude: null };
    }
    if (payload.deliveryZoneId !== undefined) {
      const zone = await this.prisma.damazonZone.findFirst({
        where: { id: payload.deliveryZoneId, ownerId: userId },
      });
      if (zone === null) {
        throw new ResourceNotFoundError('Damazon Zone', payload.deliveryZoneId);
      }
      return {
        zoneId: zone.id,
        addressId: null,
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
      };
    }
    if (payload.deliveryAddressId !== undefined) {
      const address = await this.prisma.userAddress.findFirst({
        where: { id: payload.deliveryAddressId, userId },
      });
      if (address === null) {
        throw new ResourceNotFoundError('Address', payload.deliveryAddressId);
      }
      return {
        zoneId: null,
        addressId: address.id,
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
      };
    }
    throw new BusinessRuleViolationError('A delivery destination is required');
  }

  private async persistGroup(
    client: Prisma.TransactionClient,
    context: {
      readonly userId: string;
      readonly payload: CreateOrderRequest;
      readonly destination: DestinationRecord;
      readonly group: PreparedGroup;
      readonly now: Date;
    },
  ): Promise<OrderSummary> {
    const { userId, payload, destination, group, now } = context;
    const business = await client.business.findUniqueOrThrow({
      where: { id: group.businessId },
      select: { id: true, name: true, logoUrl: true },
    });

    const initialStatus = ORDER_STATUSES.CONFIRMED;

    const order = await client.order.create({
      data: {
        orderNumber: generateOrderNumber(now),
        customerId: userId,
        businessId: business.id,
        type: 'marketplace',
        status: initialStatus,
        paymentStatus: 'pending',
        currency: 'SYP',
        subtotalMinor: group.subtotalMinor,
        deliveryFeeMinor: 0,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: group.subtotalMinor,
        destinationKind: payload.destinationKind,
        deliveryZoneId: destination.zoneId,
        deliveryAddressId: destination.addressId,
        deliveryLatitude: destination.latitude,
        deliveryLongitude: destination.longitude,
        deliveryInstructions: payload.deliveryInstructions ?? null,
        recipientName: payload.recipientName ?? null,
        recipientPhone: payload.recipientPhone ?? null,
        customerNote: payload.customerNote ?? null,
        placedAt: now,
        confirmedAt: now,
      },
    });

    await client.orderItem.createMany({
      data: group.lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId,
        nameSnapshotEn: line.nameEn,
        nameSnapshotAr: line.nameAr,
        imageSnapshotUrl: line.imageUrl,
        unitPriceMinor: line.unitPriceMinor,
        quantity: line.quantity,
        discountMinor: 0,
        totalMinor: line.unitPriceMinor * line.quantity,
      })),
    });

    await client.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: initialStatus,
        actorType: ORDER_ACTORS.CUSTOMER,
        actorId: userId,
        note: 'Cash on delivery',
      },
    });

    for (const line of group.lines) {
      await this.reserveStock(client, line, order.id, userId);
    }

    await client.payment.create({
      data: {
        orderId: order.id,
        userId,
        method: payload.paymentMethod,
        status: 'pending',
        amountMinor: group.subtotalMinor,
        currency: 'SYP',
        gateway: null,
        transactionReference: null,
      },
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: payload.paymentMethod,
      business: { id: business.id, name: business.name, logoUrl: business.logoUrl },
      itemCount: group.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalMinor: String(order.subtotalMinor),
      deliveryFeeMinor: String(order.deliveryFeeMinor),
      totalMinor: String(order.totalMinor),
      currency: order.currency,
      destinationKind: order.destinationKind,
      createdAt: order.createdAt.toISOString(),
      placedAt: order.placedAt?.toISOString() ?? null,
    };
  }

  /**
   * Conditional decrement: the `stockQuantity >= quantity` predicate makes
   * two concurrent checkouts for the last unit race safely - one wins, one
   * receives OUT_OF_STOCK, and the transaction rolls back cleanly.
   *
   * Inventory movement rows track product-level stock only; per-variant
   * movements need a schema the current model does not carry, so variant
   * lines are reflected in `product_variants.stock_quantity` alone.
   */
  private async reserveStock(
    client: Prisma.TransactionClient,
    line: PreparedLine,
    orderId: string,
    userId: string,
  ): Promise<void> {
    if (!line.trackInventory) {
      return;
    }

    if (line.variantId !== null) {
      const updated = await client.productVariant.updateMany({
        where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
        data: { stockQuantity: { decrement: line.quantity } },
      });
      if (updated.count === 0) {
        throw new OutOfStockError(line.nameAr, line.quantity, 0);
      }
      return;
    }

    const updated = await client.product.updateMany({
      where: { id: line.productId, stockQuantity: { gte: line.quantity } },
      data: { stockQuantity: { decrement: line.quantity } },
    });
    if (updated.count === 0) {
      throw new OutOfStockError(line.nameAr, line.quantity, 0);
    }
    const product = await client.product.findUniqueOrThrow({
      where: { id: line.productId },
      select: { stockQuantity: true },
    });
    await client.inventoryMovement.create({
      data: {
        productId: line.productId,
        operation: 'sale',
        quantity: line.quantity,
        balanceAfter: product.stockQuantity,
        referenceType: 'order',
        referenceId: orderId,
        actorId: userId,
      },
    });
  }

  private async loadVariants(variantIds: readonly string[]): Promise<readonly VariantRow[]> {
    if (variantIds.length === 0) {
      return [];
    }
    return this.prisma.productVariant.findMany({
      where: { id: { in: [...variantIds] } },
      select: variantRowSelect,
    });
  }
}

const orderListInclude = {
  business: { select: { id: true, name: true, logoUrl: true } },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { method: true },
  },
  _count: { select: { items: true } },
} satisfies Prisma.OrderInclude;

type OrderListRow = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;

export function toOrderSummary(row: OrderListRow): OrderSummary {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.payments[0]?.method ?? null,
    business: row.business,
    itemCount: row._count.items,
    subtotalMinor: String(row.subtotalMinor),
    deliveryFeeMinor: String(row.deliveryFeeMinor),
    totalMinor: String(row.totalMinor),
    currency: row.currency,
    destinationKind: row.destinationKind,
    createdAt: row.createdAt.toISOString(),
    placedAt: row.placedAt?.toISOString() ?? null,
  };
}

type OrderDetailRow = OrderListRow & {
  readonly items: readonly {
    readonly id: string;
    readonly nameSnapshotAr: string;
    readonly nameSnapshotEn: string;
    readonly imageSnapshotUrl: string | null;
    readonly unitPriceMinor: number;
    readonly quantity: number;
    readonly totalMinor: number;
  }[];
  readonly statusHistory: readonly {
    readonly fromStatus: string | null;
    readonly toStatus: string;
    readonly actorType: string;
    readonly note: string | null;
    readonly createdAt: Date;
  }[];
  readonly deliveryZone: { readonly id: string; readonly name: string } | null;
};

export function toOrderDetail(row: OrderDetailRow): OrderDetail {
  const history: OrderStatusEvent[] = row.statusHistory.map((event) => ({
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    actorType: event.actorType,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  }));

  return {
    ...toOrderSummary(row),
    items: row.items.map((item) => ({
      id: item.id,
      nameAr: item.nameSnapshotAr,
      nameEn: item.nameSnapshotEn,
      imageUrl: item.imageSnapshotUrl,
      unitPriceMinor: String(item.unitPriceMinor),
      quantity: item.quantity,
      totalMinor: String(item.totalMinor),
    })),
    history,
    customerNote: row.customerNote,
    deliveryInstructions: row.deliveryInstructions,
    deliveryZone: row.deliveryZone,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    cancellationReason: row.cancellationReason,
    estimatedDeliveryAt: row.estimatedDeliveryAt?.toISOString() ?? null,
  };
}
