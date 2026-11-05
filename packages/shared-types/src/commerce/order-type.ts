export const ORDER_TYPES = {
  MARKETPLACE: 'marketplace',
  RESTAURANT: 'restaurant',
  SCHEDULED: 'scheduled',
  INSTANT: 'instant',
  GIFT: 'gift',
  PICKUP: 'pickup',
  DAMAZON_ZONE: 'damazon_zone',
  THIRD_PARTY_RECIPIENT: 'third_party_recipient',
  MULTI_VENDOR: 'multi_vendor',
  MULTI_RESTAURANT: 'multi_restaurant',
} as const;

export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

export const ALL_ORDER_TYPES = Object.values(ORDER_TYPES) as readonly OrderType[];

export const FUTURE_ORDER_TYPES = [
  ORDER_TYPES.MULTI_VENDOR,
  ORDER_TYPES.MULTI_RESTAURANT,
] as const satisfies readonly OrderType[];

export const DELIVERY_DESTINATION_KINDS = {
  HOME_ADDRESS: 'home_address',
  DAMAZON_ZONE: 'damazon_zone',
  PICKUP: 'pickup',
  THIRD_PARTY_RECIPIENT: 'third_party_recipient',
} as const;

export type DeliveryDestinationKind =
  (typeof DELIVERY_DESTINATION_KINDS)[keyof typeof DELIVERY_DESTINATION_KINDS];

export const ALL_DELIVERY_DESTINATION_KINDS = Object.values(
  DELIVERY_DESTINATION_KINDS,
) as readonly DeliveryDestinationKind[];

export const DELIVERY_ASSIGNMENT_MODES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
  AI: 'ai',
} as const;

export type DeliveryAssignmentMode =
  (typeof DELIVERY_ASSIGNMENT_MODES)[keyof typeof DELIVERY_ASSIGNMENT_MODES];

export const DELIVERY_SERVICE_LEVELS = {
  STANDARD: 'standard',
  PRIORITY: 'priority',
  SCHEDULED: 'scheduled',
} as const;

export type DeliveryServiceLevel =
  (typeof DELIVERY_SERVICE_LEVELS)[keyof typeof DELIVERY_SERVICE_LEVELS];

export const ORDER_TYPE_DESTINATION_REQUIREMENTS = {
  [ORDER_TYPES.MARKETPLACE]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.RESTAURANT]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.SCHEDULED]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.INSTANT]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.GIFT]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.PICKUP]: [DELIVERY_DESTINATION_KINDS.PICKUP],
  [ORDER_TYPES.DAMAZON_ZONE]: [DELIVERY_DESTINATION_KINDS.DAMAZON_ZONE],
  [ORDER_TYPES.THIRD_PARTY_RECIPIENT]: [DELIVERY_DESTINATION_KINDS.THIRD_PARTY_RECIPIENT],
  [ORDER_TYPES.MULTI_VENDOR]: ALL_DELIVERY_DESTINATION_KINDS,
  [ORDER_TYPES.MULTI_RESTAURANT]: ALL_DELIVERY_DESTINATION_KINDS,
} as const satisfies Record<OrderType, readonly DeliveryDestinationKind[]>;

export function allowedDestinationKinds(type: OrderType): readonly DeliveryDestinationKind[] {
  return ORDER_TYPE_DESTINATION_REQUIREMENTS[type];
}

export function isDestinationKindAllowed(type: OrderType, kind: DeliveryDestinationKind): boolean {
  return (allowedDestinationKinds(type) as readonly string[]).includes(kind);
}

export function requiresFieldDelivery(kind: DeliveryDestinationKind): boolean {
  return kind !== DELIVERY_DESTINATION_KINDS.PICKUP;
}

export function isFutureOrderType(orderType: OrderType): boolean {
  return (FUTURE_ORDER_TYPES as readonly string[]).includes(orderType);
}
