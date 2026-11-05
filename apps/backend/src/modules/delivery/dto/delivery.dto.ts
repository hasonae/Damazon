import { z } from 'zod';
import type { DeliveryTaskStatus } from '@damazon/shared-types';

export const deliveryTaskIdSchema = z.string().uuid();

export const listDeliveryTasksQuerySchema = z
  .object({
    status: z
      .enum([
        'unassigned',
        'offered',
        'assigned',
        'accepted',
        'picked_up',
        'in_transit',
        'arrived_at_destination',
        'delivered',
        'failed',
        'cancelled',
        'returned',
      ])
      .optional(),
  })
  .strict();

export type ListDeliveryTasksQuery = z.infer<typeof listDeliveryTasksQuerySchema>;

export const assignDeliveryTaskSchema = z
  .object({ taskId: z.string().uuid(), driverId: z.string().uuid() })
  .strict();

export type AssignDeliveryTaskRequest = z.infer<typeof assignDeliveryTaskSchema>;

export const updateDeliveryTaskSchema = z
  .object({
    status: z.enum(['accepted', 'picked_up', 'in_transit', 'arrived_at_destination', 'delivered']),
    cashCollected: z.literal(true).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'delivered' && value.cashCollected !== true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cashCollected'],
        message: 'Cash must be collected before completing a cash-on-delivery order',
      });
    }
    if (value.status !== 'delivered' && value.cashCollected !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cashCollected'],
        message: 'Cash collection can only be confirmed when completing delivery',
      });
    }
  });

export type UpdateDeliveryTaskRequest = z.infer<typeof updateDeliveryTaskSchema>;

export const updateDriverAvailabilitySchema = z
  .object({ status: z.enum(['available', 'offline', 'on_break']) })
  .strict();

export type UpdateDriverAvailabilityRequest = z.infer<typeof updateDriverAvailabilitySchema>;

export const updateDriverLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export type UpdateDriverLocationRequest = z.infer<typeof updateDriverLocationSchema>;

export const driverApplicationSchema = z
  .object({
    vehicleType: z.enum(['motorcycle', 'bicycle', 'car', 'van', 'truck', 'walking']),
    vehiclePlateNumber: z.string().trim().min(2).max(24).optional(),
  })
  .strict();

export type DriverApplicationRequest = z.infer<typeof driverApplicationSchema>;

export interface DriverApplicationView {
  readonly status: string | null;
  readonly vehicleType: string | null;
  readonly vehiclePlateNumber: string | null;
}

export interface DeliveryTaskView {
  readonly id: string;
  readonly status: DeliveryTaskStatus;
  readonly order: {
    readonly id: string;
    readonly orderNumber: string;
    readonly status: string;
    readonly businessName: string;
    readonly customerName: string;
    readonly customerPhone: string;
    readonly totalMinor: string;
    readonly currency: string;
  };
  readonly pickup: { readonly latitude: number | null; readonly longitude: number | null };
  readonly destination: { readonly latitude: number | null; readonly longitude: number | null };
  readonly driver: { readonly id: string; readonly name: string } | null;
  readonly estimatedArrivalAt: string | null;
  readonly createdAt: string;
}

export interface DeliveryDriverView {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly status: string;
  readonly vehicleType: string;
  readonly completedDeliveries: number;
}
