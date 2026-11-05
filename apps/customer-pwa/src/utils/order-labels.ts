/**
 * Order status presentation helpers shared by the orders list, the order
 * detail timeline, and the checkout confirmation.
 */

import type { Tone } from '@damazon/design-system';

import { STRINGS, type StringKey } from '../locales/strings.js';

export function orderStatusKey(status: string): StringKey {
  const key = `order.status.${status}` as StringKey;
  return key in STRINGS ? key : 'order.pending';
}

export function deliveryStatusKey(status: string | null): StringKey {
  if (status === null) {
    return 'common.na';
  }
  const key = `delivery.status.${status}` as StringKey;
  return key in STRINGS ? key : 'common.na';
}

export function paymentMethodKey(method: string): StringKey {
  const key = `order.pay.${method}` as StringKey;
  return key in STRINGS ? key : 'common.na';
}

export function paymentStatusKey(status: string): StringKey {
  const key = `order.payment.${status}` as StringKey;
  return key in STRINGS ? key : 'common.na';
}

const STATUS_TONES: Readonly<Record<string, Tone>> = {
  draft: 'neutral',
  pending_payment: 'warning',
  confirmed: 'info',
  preparing: 'warning',
  ready: 'accent',
  driver_assigned: 'info',
  driver_accepted: 'info',
  on_the_way: 'info',
  arrived: 'info',
  delivered: 'success',
  completed: 'success',
  cancelled: 'danger',
  expired: 'danger',
  failed: 'danger',
  disputed: 'danger',
  refunded: 'warning',
  returned: 'warning',
};

export function orderStatusTone(status: string): Tone {
  return STATUS_TONES[status] ?? 'neutral';
}

/** Statuses in which the customer may still cancel (state machine rule). */
export function canCustomerCancel(status: string): boolean {
  return (
    status === 'draft' ||
    status === 'pending_payment' ||
    status === 'confirmed' ||
    status === 'ready'
  );
}
