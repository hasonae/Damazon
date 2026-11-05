export const REALTIME_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  DRIVER_LOCATION: 'driver.location',
  MESSAGE_RECEIVED: 'message.received',
  NOTIFICATION_NEW: 'notification.new',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export const ALL_REALTIME_EVENTS = Object.values(REALTIME_EVENTS) as readonly RealtimeEvent[];

export const REALTIME_CHANNELS = {
  ORDER: 'order',
  DRIVER_LOCATION: 'driver-location',
  MESSAGE: 'message',
  NOTIFICATION: 'notification',
} as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

export interface RealtimeEnvelope<TPayload> {
  readonly event: RealtimeEvent;
  readonly channel: RealtimeChannel;
  readonly emittedAt: string;
  readonly payload: TPayload;
}

export function realtimeChannelForEvent(event: RealtimeEvent): RealtimeChannel {
  switch (event) {
    case REALTIME_EVENTS.ORDER_CREATED:
    case REALTIME_EVENTS.ORDER_UPDATED:
      return REALTIME_CHANNELS.ORDER;
    case REALTIME_EVENTS.DRIVER_LOCATION:
      return REALTIME_CHANNELS.DRIVER_LOCATION;
    case REALTIME_EVENTS.MESSAGE_RECEIVED:
      return REALTIME_CHANNELS.MESSAGE;
    case REALTIME_EVENTS.NOTIFICATION_NEW:
      return REALTIME_CHANNELS.NOTIFICATION;
  }
}
