import { z } from 'zod';
import { ALL_ORDER_STATUSES, type OrderStatus } from '@damazon/shared-types';

/**
 * Order transport contracts.
 *
 * Checkout is intentionally one request: it validates inventory, captures the
 * destination, splits the cart by business, and records cash-on-delivery payment. The
 * client never assembles an order from parts, because a partial order is an
 * unrecoverable state for the customer.
 */

export const createOrderSchema = z
  .object({
    paymentMethod: z.literal('cash_on_delivery'),
    destinationKind: z
      .enum(['home_address', 'damazon_zone', 'pickup', 'third_party_recipient'])
      .default('damazon_zone'),
    deliveryZoneId: z.string().uuid().optional(),
    deliveryAddressId: z.string().uuid().optional(),
    deliveryInstructions: z.string().trim().max(500).optional(),
    recipientName: z.string().trim().max(160).optional(),
    recipientPhone: z.string().trim().max(20).optional(),
    customerNote: z.string().trim().max(600).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.destinationKind === 'damazon_zone' && value.deliveryZoneId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryZoneId'],
        message: 'A Damazon Zone is required for zone delivery',
      });
    }
    if (value.destinationKind === 'home_address' && value.deliveryAddressId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryAddressId'],
        message: 'An address is required for home delivery',
      });
    }
    if (
      value.destinationKind === 'third_party_recipient' &&
      value.deliveryZoneId === undefined &&
      value.deliveryAddressId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryZoneId'],
        message: 'A third-party delivery needs a zone or an address',
      });
    }
    if (
      value.destinationKind === 'third_party_recipient' &&
      (value.recipientName === undefined || value.recipientPhone === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipientName'],
        message: 'Recipient name and phone are required',
      });
    }
  });

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export const listOrdersQuerySchema = z
  .object({
    status: z.enum(ALL_ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const cancelOrderSchema = z
  .object({
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export type CancelOrderRequest = z.infer<typeof cancelOrderSchema>;

export const updateSellerOrderStatusSchema = z
  .object({
    status: z.enum(['preparing', 'ready']),
  })
  .strict();

export type UpdateSellerOrderStatusRequest = z.infer<typeof updateSellerOrderStatusSchema>;

export const orderIdParamSchema = z.string().uuid();

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly paymentMethod: string | null;
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly logoUrl: string | null;
  };
  readonly itemCount: number;
  readonly subtotalMinor: string;
  readonly deliveryFeeMinor: string;
  readonly totalMinor: string;
  readonly currency: string;
  readonly destinationKind: string;
  readonly createdAt: string;
  readonly placedAt: string | null;
}

export interface OrderItemView {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly imageUrl: string | null;
  readonly unitPriceMinor: string;
  readonly quantity: number;
  readonly totalMinor: string;
}

export interface OrderStatusEvent {
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly actorType: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  readonly items: readonly OrderItemView[];
  readonly history: readonly OrderStatusEvent[];
  readonly customerNote: string | null;
  readonly deliveryInstructions: string | null;
  readonly deliveryZone: { readonly id: string; readonly name: string } | null;
  readonly recipientName: string | null;
  readonly recipientPhone: string | null;
  readonly cancellationReason: string | null;
  readonly estimatedDeliveryAt: string | null;
}

export interface CreateOrderResponse {
  readonly orders: readonly OrderSummary[];
}
