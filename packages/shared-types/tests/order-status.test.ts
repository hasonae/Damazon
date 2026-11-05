import { describe, expect, it } from 'vitest';
import {
  ALL_ORDER_STATUSES,
  ORDER_ACTORS,
  ORDER_STATUSES,
  availableOrderTransitions,
  isOrderClosed,
  isOrderInDelivery,
  isOrderTransitionAllowed,
  isSuccessfulOrderStatus,
  isTerminalOrderStatus,
  orderProgressIndex,
  orderProgressPercent,
  reachableOrderStatusPaths,
  statusesWithoutClosedPath,
  unreachableOrderStatuses,
} from '../src/commerce/order-status.js';
import type { OrderStatus } from '../src/commerce/order-status.js';

describe('order lifecycle', () => {
  it('permits the documented happy path for each responsible actor', () => {
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.PENDING_PAYMENT,
        ORDER_STATUSES.CONFIRMED,
        ORDER_ACTORS.PAYMENT_GATEWAY,
      ),
    ).toBe(true);
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.CONFIRMED,
        ORDER_STATUSES.PREPARING,
        ORDER_ACTORS.SELLER,
      ),
    ).toBe(true);
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.DRIVER_ASSIGNED,
        ORDER_STATUSES.DRIVER_ACCEPTED,
        ORDER_ACTORS.DRIVER,
      ),
    ).toBe(true);
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.ARRIVED,
        ORDER_STATUSES.DELIVERED,
        ORDER_ACTORS.DRIVER,
      ),
    ).toBe(true);
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.COMPLETED,
        ORDER_ACTORS.CUSTOMER,
      ),
    ).toBe(true);
  });

  it('rejects transitions that skip mandatory stages', () => {
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.CONFIRMED,
        ORDER_STATUSES.DELIVERED,
        ORDER_ACTORS.ADMIN,
      ),
    ).toBe(false);
    expect(
      isOrderTransitionAllowed(ORDER_STATUSES.DRAFT, ORDER_STATUSES.READY, ORDER_ACTORS.SELLER),
    ).toBe(false);
  });

  it('rejects stage transitions performed by the wrong actor', () => {
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.CONFIRMED,
        ORDER_STATUSES.PREPARING,
        ORDER_ACTORS.CUSTOMER,
      ),
    ).toBe(false);
    expect(
      isOrderTransitionAllowed(
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.COMPLETED,
        ORDER_ACTORS.DRIVER,
      ),
    ).toBe(false);
  });

  it('treats cancelled, refunded, returned, expired and failed orders as terminal', () => {
    const terminal: readonly OrderStatus[] = [
      ORDER_STATUSES.CANCELLED,
      ORDER_STATUSES.REFUNDED,
      ORDER_STATUSES.RETURNED,
      ORDER_STATUSES.EXPIRED,
      ORDER_STATUSES.FAILED,
    ];
    for (const status of terminal) {
      expect(isTerminalOrderStatus(status)).toBe(true);
      expect(isOrderClosed(status)).toBe(true);
      expect(availableOrderTransitions(status, ORDER_ACTORS.ADMIN)).toHaveLength(0);
      expect(availableOrderTransitions(status, ORDER_ACTORS.CUSTOMER)).toHaveLength(0);
    }
  });

  it('keeps a completed order open for the dispute window but settles it on screen', () => {
    expect(isTerminalOrderStatus(ORDER_STATUSES.COMPLETED)).toBe(false);
    expect(isOrderClosed(ORDER_STATUSES.COMPLETED)).toBe(true);
    expect(isSuccessfulOrderStatus(ORDER_STATUSES.COMPLETED)).toBe(true);
    expect(orderProgressPercent(ORDER_STATUSES.COMPLETED)).toBe(100);
    expect(availableOrderTransitions(ORDER_STATUSES.COMPLETED, ORDER_ACTORS.ADMIN)).toStrictEqual([
      ORDER_STATUSES.DISPUTED,
      ORDER_STATUSES.REFUNDED,
    ]);
    expect(orderProgressPercent(ORDER_STATUSES.CANCELLED)).toBe(0);
  });

  it('requires an administrator to settle a dispute', () => {
    expect(availableOrderTransitions(ORDER_STATUSES.DISPUTED, ORDER_ACTORS.ADMIN)).toStrictEqual([
      ORDER_STATUSES.COMPLETED,
      ORDER_STATUSES.REFUNDED,
    ]);
    expect(availableOrderTransitions(ORDER_STATUSES.DISPUTED, ORDER_ACTORS.CUSTOMER)).toHaveLength(
      0,
    );
  });

  it('never strands an order in a non-terminal state', () => {
    expect(statusesWithoutClosedPath()).toHaveLength(0);
    expect(unreachableOrderStatuses()).toHaveLength(0);
    for (const status of ALL_ORDER_STATUSES) {
      expect(reachableOrderStatusPaths(status).length).toBeGreaterThan(0);
      for (const path of reachableOrderStatusPaths(status)) {
        expect(isOrderClosed(path[path.length - 1])).toBe(true);
      }
    }
  });

  it('reports delivery progress for tracking stages only', () => {
    expect(isOrderInDelivery(ORDER_STATUSES.ON_THE_WAY)).toBe(true);
    expect(isOrderInDelivery(ORDER_STATUSES.PREPARING)).toBe(false);
    expect(orderProgressIndex(ORDER_STATUSES.ON_THE_WAY)).toBeGreaterThan(
      orderProgressIndex(ORDER_STATUSES.READY),
    );
    expect(orderProgressIndex(ORDER_STATUSES.CANCELLED)).toBe(0);
  });
});
