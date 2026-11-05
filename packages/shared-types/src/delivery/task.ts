export const DELIVERY_TASK_STATUSES = {
  UNASSIGNED: 'unassigned',
  OFFERED: 'offered',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  ARRIVED_AT_DESTINATION: 'arrived_at_destination',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const;

export type DeliveryTaskStatus =
  (typeof DELIVERY_TASK_STATUSES)[keyof typeof DELIVERY_TASK_STATUSES];

export const ALL_DELIVERY_TASK_STATUSES = Object.values(
  DELIVERY_TASK_STATUSES,
) as readonly DeliveryTaskStatus[];

export const DELIVERY_TASK_TRANSITIONS = {
  [DELIVERY_TASK_STATUSES.UNASSIGNED]: [DELIVERY_TASK_STATUSES.OFFERED],
  [DELIVERY_TASK_STATUSES.OFFERED]: [DELIVERY_TASK_STATUSES.ASSIGNED],
  [DELIVERY_TASK_STATUSES.ASSIGNED]: [
    DELIVERY_TASK_STATUSES.ACCEPTED,
    DELIVERY_TASK_STATUSES.OFFERED,
  ],
  [DELIVERY_TASK_STATUSES.ACCEPTED]: [
    DELIVERY_TASK_STATUSES.PICKED_UP,
    DELIVERY_TASK_STATUSES.ASSIGNED,
  ],
  [DELIVERY_TASK_STATUSES.PICKED_UP]: [DELIVERY_TASK_STATUSES.IN_TRANSIT],
  [DELIVERY_TASK_STATUSES.IN_TRANSIT]: [
    DELIVERY_TASK_STATUSES.ARRIVED_AT_DESTINATION,
    DELIVERY_TASK_STATUSES.FAILED,
  ],
  [DELIVERY_TASK_STATUSES.ARRIVED_AT_DESTINATION]: [
    DELIVERY_TASK_STATUSES.DELIVERED,
    DELIVERY_TASK_STATUSES.FAILED,
  ],
  [DELIVERY_TASK_STATUSES.DELIVERED]: [DELIVERY_TASK_STATUSES.RETURNED],
  [DELIVERY_TASK_STATUSES.FAILED]: [DELIVERY_TASK_STATUSES.OFFERED],
  [DELIVERY_TASK_STATUSES.CANCELLED]: [],
  [DELIVERY_TASK_STATUSES.RETURNED]: [],
} as const satisfies Record<DeliveryTaskStatus, readonly DeliveryTaskStatus[]>;

export const DRIVER_STATUSES = {
  OFFLINE: 'offline',
  AVAILABLE: 'available',
  BUSY: 'busy',
  ON_BREAK: 'on_break',
  SUSPENDED: 'suspended',
} as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[keyof typeof DRIVER_STATUSES];

export const ALL_DRIVER_STATUSES = Object.values(DRIVER_STATUSES) as readonly DriverStatus[];

export const DRIVER_TRANSITIONS = {
  [DRIVER_STATUSES.OFFLINE]: [DRIVER_STATUSES.AVAILABLE],
  [DRIVER_STATUSES.AVAILABLE]: [
    DRIVER_STATUSES.BUSY,
    DRIVER_STATUSES.ON_BREAK,
    DRIVER_STATUSES.OFFLINE,
    DRIVER_STATUSES.SUSPENDED,
  ],
  [DRIVER_STATUSES.BUSY]: [DRIVER_STATUSES.AVAILABLE, DRIVER_STATUSES.ON_BREAK],
  [DRIVER_STATUSES.ON_BREAK]: [
    DRIVER_STATUSES.AVAILABLE,
    DRIVER_STATUSES.OFFLINE,
    DRIVER_STATUSES.SUSPENDED,
  ],
  [DRIVER_STATUSES.SUSPENDED]: [DRIVER_STATUSES.OFFLINE, DRIVER_STATUSES.AVAILABLE],
} as const satisfies Record<DriverStatus, readonly DriverStatus[]>;

export const VEHICLE_TYPES = {
  MOTORCYCLE: 'motorcycle',
  BICYCLE: 'bicycle',
  CAR: 'car',
  VAN: 'van',
  TRUCK: 'truck',
  WALKING: 'walking',
} as const;

export type VehicleType = (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];

export const VEHICLE_CAPACITY = {
  [VEHICLE_TYPES.MOTORCYCLE]: 3,
  [VEHICLE_TYPES.BICYCLE]: 2,
  [VEHICLE_TYPES.CAR]: 8,
  [VEHICLE_TYPES.VAN]: 30,
  [VEHICLE_TYPES.TRUCK]: 120,
  [VEHICLE_TYPES.WALKING]: 1,
} as const satisfies Record<VehicleType, number>;

export function vehicleCapacity(type: VehicleType): number {
  return VEHICLE_CAPACITY[type];
}

export function isDriverAvailableForAssignment(status: DriverStatus): boolean {
  return status === DRIVER_STATUSES.AVAILABLE;
}

export function assertDriverTransition(from: DriverStatus, to: DriverStatus): void {
  if (!(DRIVER_TRANSITIONS[from] as readonly string[]).includes(to)) {
    throw new Error(`Illegal driver transition: ${from} -> ${to}`);
  }
}

export function isDeliveryTaskTransitionAllowed(
  from: DeliveryTaskStatus,
  to: DeliveryTaskStatus,
): boolean {
  return (DELIVERY_TASK_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertDeliveryTaskTransition(
  from: DeliveryTaskStatus,
  to: DeliveryTaskStatus,
): void {
  if (!isDeliveryTaskTransitionAllowed(from, to)) {
    throw new Error(`Illegal delivery task transition: ${from} -> ${to}`);
  }
}

export function isTerminalDeliveryTaskStatus(status: DeliveryTaskStatus): boolean {
  return status === DELIVERY_TASK_STATUSES.CANCELLED || status === DELIVERY_TASK_STATUSES.RETURNED;
}

export const DELIVERY_FAILURE_REASONS = {
  RECIPIENT_UNAVAILABLE: 'recipient_unavailable',
  RECIPIENT_REFUSED: 'recipient_refused',
  WRONG_ADDRESS: 'wrong_address',
  ZONE_UNREACHABLE: 'zone_unreachable',
  VEHICLE_FAILURE: 'vehicle_failure',
  TRAFFIC_BLOCKED: 'traffic_blocked',
  WEATHER_CONDITIONS: 'weather_conditions',
} as const;

export type DeliveryFailureReason =
  (typeof DELIVERY_FAILURE_REASONS)[keyof typeof DELIVERY_FAILURE_REASONS];
