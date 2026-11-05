export const ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  DRIVER_ASSIGNED: 'driver_assigned',
  DRIVER_ACCEPTED: 'driver_accepted',
  ON_THE_WAY: 'on_the_way',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  RETURNED: 'returned',
  EXPIRED: 'expired',
  FAILED: 'failed',
  DISPUTED: 'disputed',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ALL_ORDER_STATUSES = Object.values(ORDER_STATUSES) as readonly OrderStatus[];

export const ORDER_ACTORS = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  DRIVER: 'driver',
  DELIVERY_COMPANY: 'delivery_company',
  PAYMENT_GATEWAY: 'payment_gateway',
  SYSTEM: 'system',
  ADMIN: 'admin',
} as const;

export type OrderActor = (typeof ORDER_ACTORS)[keyof typeof ORDER_ACTORS];

export interface OrderTransitionRule {
  readonly to: OrderStatus;
  readonly actors: readonly OrderActor[];
}

export const ORDER_TRANSITIONS = {
  [ORDER_STATUSES.DRAFT]: [
    { to: ORDER_STATUSES.PENDING_PAYMENT, actors: [ORDER_ACTORS.CUSTOMER] },
    { to: ORDER_STATUSES.CANCELLED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.SELLER] },
  ],
  [ORDER_STATUSES.PENDING_PAYMENT]: [
    {
      to: ORDER_STATUSES.CONFIRMED,
      actors: [ORDER_ACTORS.PAYMENT_GATEWAY, ORDER_ACTORS.SYSTEM],
    },
    {
      to: ORDER_STATUSES.FAILED,
      actors: [ORDER_ACTORS.PAYMENT_GATEWAY, ORDER_ACTORS.SYSTEM],
    },
    { to: ORDER_STATUSES.EXPIRED, actors: [ORDER_ACTORS.SYSTEM] },
    { to: ORDER_STATUSES.CANCELLED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.SELLER] },
  ],
  [ORDER_STATUSES.CONFIRMED]: [
    { to: ORDER_STATUSES.PREPARING, actors: [ORDER_ACTORS.SELLER] },
    { to: ORDER_STATUSES.CANCELLED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.SELLER] },
    { to: ORDER_STATUSES.REFUNDED, actors: [ORDER_ACTORS.ADMIN] },
  ],
  [ORDER_STATUSES.PREPARING]: [
    { to: ORDER_STATUSES.READY, actors: [ORDER_ACTORS.SELLER] },
    { to: ORDER_STATUSES.CANCELLED, actors: [ORDER_ACTORS.SELLER] },
  ],
  [ORDER_STATUSES.READY]: [
    { to: ORDER_STATUSES.DRIVER_ASSIGNED, actors: [ORDER_ACTORS.DELIVERY_COMPANY] },
    { to: ORDER_STATUSES.DRIVER_ACCEPTED, actors: [ORDER_ACTORS.DRIVER] },
    { to: ORDER_STATUSES.PREPARING, actors: [ORDER_ACTORS.SELLER] },
    { to: ORDER_STATUSES.CANCELLED, actors: [ORDER_ACTORS.SELLER, ORDER_ACTORS.CUSTOMER] },
  ],
  [ORDER_STATUSES.DRIVER_ASSIGNED]: [
    { to: ORDER_STATUSES.DRIVER_ACCEPTED, actors: [ORDER_ACTORS.DRIVER] },
    {
      to: ORDER_STATUSES.READY,
      actors: [ORDER_ACTORS.DELIVERY_COMPANY],
    },
  ],
  [ORDER_STATUSES.DRIVER_ACCEPTED]: [
    { to: ORDER_STATUSES.ON_THE_WAY, actors: [ORDER_ACTORS.DRIVER] },
    {
      to: ORDER_STATUSES.READY,
      actors: [ORDER_ACTORS.DELIVERY_COMPANY],
    },
  ],
  [ORDER_STATUSES.ON_THE_WAY]: [
    { to: ORDER_STATUSES.ARRIVED, actors: [ORDER_ACTORS.DRIVER] },
    {
      to: ORDER_STATUSES.FAILED,
      actors: [ORDER_ACTORS.DRIVER, ORDER_ACTORS.DELIVERY_COMPANY],
    },
  ],
  [ORDER_STATUSES.ARRIVED]: [{ to: ORDER_STATUSES.DELIVERED, actors: [ORDER_ACTORS.DRIVER] }],
  [ORDER_STATUSES.DELIVERED]: [
    { to: ORDER_STATUSES.COMPLETED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.SYSTEM] },
    { to: ORDER_STATUSES.DISPUTED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.ADMIN] },
    { to: ORDER_STATUSES.RETURNED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.ADMIN] },
  ],
  [ORDER_STATUSES.COMPLETED]: [
    { to: ORDER_STATUSES.DISPUTED, actors: [ORDER_ACTORS.CUSTOMER, ORDER_ACTORS.ADMIN] },
    { to: ORDER_STATUSES.REFUNDED, actors: [ORDER_ACTORS.ADMIN] },
  ],
  [ORDER_STATUSES.DISPUTED]: [
    { to: ORDER_STATUSES.COMPLETED, actors: [ORDER_ACTORS.ADMIN] },
    { to: ORDER_STATUSES.REFUNDED, actors: [ORDER_ACTORS.ADMIN] },
  ],
  [ORDER_STATUSES.CANCELLED]: [],
  [ORDER_STATUSES.REFUNDED]: [],
  [ORDER_STATUSES.RETURNED]: [],
  [ORDER_STATUSES.EXPIRED]: [],
  [ORDER_STATUSES.FAILED]: [],
} as const satisfies Record<OrderStatus, readonly OrderTransitionRule[]>;

export const ORDER_HAPPY_PATH = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.READY,
  ORDER_STATUSES.DRIVER_ASSIGNED,
  ORDER_STATUSES.DRIVER_ACCEPTED,
  ORDER_STATUSES.ON_THE_WAY,
  ORDER_STATUSES.ARRIVED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.COMPLETED,
] as const satisfies readonly OrderStatus[];

export const ORDER_TERMINAL_STATUSES = [
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.REFUNDED,
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.EXPIRED,
  ORDER_STATUSES.FAILED,
] as const satisfies readonly OrderStatus[];

export const ORDER_SUCCESS_STATUSES = [
  ORDER_STATUSES.COMPLETED,
] as const satisfies readonly OrderStatus[];

export const ORDER_UNFULFILLED_STATUSES = [
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.REFUNDED,
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.EXPIRED,
  ORDER_STATUSES.FAILED,
] as const satisfies readonly OrderStatus[];

export const DELIVERY_TRACKED_STATUSES = [
  ORDER_STATUSES.DRIVER_ASSIGNED,
  ORDER_STATUSES.DRIVER_ACCEPTED,
  ORDER_STATUSES.ON_THE_WAY,
  ORDER_STATUSES.ARRIVED,
] as const satisfies readonly OrderStatus[];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ALL_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isOrderActor(value: unknown): value is OrderActor {
  return (
    typeof value === 'string' && (Object.values(ORDER_ACTORS) as readonly string[]).includes(value)
  );
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (ORDER_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isSuccessfulOrderStatus(status: OrderStatus): boolean {
  return (ORDER_SUCCESS_STATUSES as readonly string[]).includes(status);
}

export function isOrderClosed(status: OrderStatus): boolean {
  return isTerminalOrderStatus(status) || isSuccessfulOrderStatus(status);
}

export function isUnfulfilledOrderStatus(status: OrderStatus): boolean {
  return (ORDER_UNFULFILLED_STATUSES as readonly string[]).includes(status);
}

export function isOrderTransitionAllowed(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderActor,
): boolean {
  const rules: readonly OrderTransitionRule[] = ORDER_TRANSITIONS[from];
  return rules.some((rule) => rule.to === to && (rule.actors as readonly string[]).includes(actor));
}

export function availableOrderTransitions(
  from: OrderStatus,
  actor: OrderActor,
): readonly OrderStatus[] {
  const rules: readonly OrderTransitionRule[] = ORDER_TRANSITIONS[from];
  return rules
    .filter((rule) => (rule.actors as readonly string[]).includes(actor))
    .map((r) => r.to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): void {
  if (!isOrderTransitionAllowed(from, to, actor)) {
    throw new Error(`Illegal order transition for ${actor}: ${from} -> ${to}`);
  }
}

export function orderProgressIndex(status: OrderStatus): number {
  const index = (ORDER_HAPPY_PATH as readonly string[]).indexOf(status);
  return index === -1 ? 0 : index;
}

export function orderProgressPercent(status: OrderStatus): number {
  if (isSuccessfulOrderStatus(status)) {
    return 100;
  }
  if (isUnfulfilledOrderStatus(status)) {
    return 0;
  }
  const steps = ORDER_HAPPY_PATH.length;
  const completed = orderProgressIndex(status);
  if (completed <= 0) {
    return 0;
  }
  return Math.round(((completed - 1) / (steps - 1)) * 100);
}

export function isOrderInDelivery(status: OrderStatus): boolean {
  return (DELIVERY_TRACKED_STATUSES as readonly string[]).includes(status);
}

export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  const rules: readonly OrderTransitionRule[] = ORDER_TRANSITIONS[status];
  return Array.from(new Set(rules.map((rule) => rule.to)));
}

function collectReachablePaths(
  current: OrderStatus,
  path: readonly OrderStatus[],
  collected: OrderStatus[][],
): void {
  if (isOrderClosed(current)) {
    collected.push([...path]);
    return;
  }
  const next = nextOrderStatuses(current).filter((candidate) => !path.includes(candidate));
  for (const candidate of next) {
    collectReachablePaths(candidate, [...path, candidate], collected);
  }
}

export function reachableOrderStatusPaths(start: OrderStatus): readonly OrderStatus[][] {
  const collected: OrderStatus[][] = [];
  collectReachablePaths(start, [start], collected);
  return collected;
}

export function allOrderStatusPaths(): readonly OrderStatus[][] {
  return ALL_ORDER_STATUSES.flatMap((status) => reachableOrderStatusPaths(status));
}

export function statusesWithoutClosedPath(): readonly OrderStatus[] {
  return ALL_ORDER_STATUSES.filter(
    (status) => !isOrderClosed(status) && reachableOrderStatusPaths(status).length === 0,
  );
}

export function unreachableOrderStatuses(): readonly OrderStatus[] {
  const reached = new Set<OrderStatus>();
  for (const path of allOrderStatusPaths()) {
    for (const status of path) {
      reached.add(status);
    }
  }
  return ALL_ORDER_STATUSES.filter((status) => !reached.has(status));
}
