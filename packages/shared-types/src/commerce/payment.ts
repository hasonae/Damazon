export const PAYMENT_METHODS = {
  SHAM_CASH: 'sham_cash',
  QR_PAYMENT: 'qr_payment',
  CASH_ON_DELIVERY: 'cash_on_delivery',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const ALL_PAYMENT_METHODS = Object.values(PAYMENT_METHODS) as readonly PaymentMethod[];

export const ONLINE_PAYMENT_METHODS = [
  PAYMENT_METHODS.SHAM_CASH,
  PAYMENT_METHODS.QR_PAYMENT,
] as const satisfies readonly PaymentMethod[];

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  INITIATED: 'initiated',
  AWAITING_VERIFICATION: 'awaiting_verification',
  VERIFYING: 'verifying',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
  REVERSED: 'reversed',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUSES) as readonly PaymentStatus[];

export const PAYMENT_TRANSITIONS = {
  [PAYMENT_STATUSES.PENDING]: [
    PAYMENT_STATUSES.INITIATED,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.EXPIRED,
  ],
  [PAYMENT_STATUSES.INITIATED]: [
    PAYMENT_STATUSES.AWAITING_VERIFICATION,
    PAYMENT_STATUSES.SUCCEEDED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.EXPIRED,
    PAYMENT_STATUSES.CANCELLED,
  ],
  [PAYMENT_STATUSES.AWAITING_VERIFICATION]: [
    PAYMENT_STATUSES.VERIFYING,
    PAYMENT_STATUSES.SUCCEEDED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.EXPIRED,
  ],
  [PAYMENT_STATUSES.VERIFYING]: [PAYMENT_STATUSES.SUCCEEDED, PAYMENT_STATUSES.FAILED],
  [PAYMENT_STATUSES.SUCCEEDED]: [
    PAYMENT_STATUSES.PARTIALLY_REFUNDED,
    PAYMENT_STATUSES.REFUNDED,
    PAYMENT_STATUSES.REVERSED,
  ],
  [PAYMENT_STATUSES.PARTIALLY_REFUNDED]: [PAYMENT_STATUSES.REFUNDED],
  [PAYMENT_STATUSES.FAILED]: [],
  [PAYMENT_STATUSES.EXPIRED]: [],
  [PAYMENT_STATUSES.CANCELLED]: [],
  [PAYMENT_STATUSES.REFUNDED]: [],
  [PAYMENT_STATUSES.REVERSED]: [],
} as const satisfies Record<PaymentStatus, readonly PaymentStatus[]>;

export const PAYMENT_TERMINAL_STATUSES = [
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.EXPIRED,
  PAYMENT_STATUSES.CANCELLED,
  PAYMENT_STATUSES.REFUNDED,
  PAYMENT_STATUSES.REVERSED,
] as const satisfies readonly PaymentStatus[];

export const PAYMENT_SETTLED_STATUSES = [
  PAYMENT_STATUSES.SUCCEEDED,
  PAYMENT_STATUSES.PARTIALLY_REFUNDED,
] as const satisfies readonly PaymentStatus[];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (ALL_PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return (PAYMENT_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isPaymentTransitionAllowed(from: PaymentStatus, to: PaymentStatus): boolean {
  return (PAYMENT_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!isPaymentTransitionAllowed(from, to)) {
    throw new Error(`Illegal payment transition: ${from} -> ${to}`);
  }
}

export function requiresGatewayVerification(method: PaymentMethod): boolean {
  return (ONLINE_PAYMENT_METHODS as readonly string[]).includes(method);
}

export const PAYMENT_FAILURE_REASONS = {
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  GATEWAY_REJECTED: 'gateway_rejected',
  TRANSACTION_NOT_FOUND: 'transaction_not_found',
  AMOUNT_MISMATCH: 'amount_mismatch',
  CURRENCY_MISMATCH: 'currency_mismatch',
  REFERENCE_ALREADY_USED: 'reference_already_used',
  MERCHANT_ACCOUNT_SUSPENDED: 'merchant_account_suspended',
  GATEWAY_UNAVAILABLE: 'gateway_unavailable',
} as const;

export type PaymentFailureReason =
  (typeof PAYMENT_FAILURE_REASONS)[keyof typeof PAYMENT_FAILURE_REASONS];
