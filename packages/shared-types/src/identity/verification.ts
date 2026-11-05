export const VERIFICATION_STATUSES = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
} as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[keyof typeof VERIFICATION_STATUSES];

export const ALL_VERIFICATION_STATUSES = Object.values(
  VERIFICATION_STATUSES,
) as readonly VerificationStatus[];

export const VERIFICATION_TRANSITIONS = {
  [VERIFICATION_STATUSES.PENDING]: [
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.REJECTED,
  ],
  [VERIFICATION_STATUSES.UNDER_REVIEW]: [
    VERIFICATION_STATUSES.APPROVED,
    VERIFICATION_STATUSES.REJECTED,
    VERIFICATION_STATUSES.PENDING,
  ],
  [VERIFICATION_STATUSES.APPROVED]: [
    VERIFICATION_STATUSES.SUSPENDED,
    VERIFICATION_STATUSES.BLOCKED,
  ],
  [VERIFICATION_STATUSES.REJECTED]: [VERIFICATION_STATUSES.PENDING, VERIFICATION_STATUSES.BLOCKED],
  [VERIFICATION_STATUSES.SUSPENDED]: [
    VERIFICATION_STATUSES.APPROVED,
    VERIFICATION_STATUSES.BLOCKED,
    VERIFICATION_STATUSES.PENDING,
  ],
  [VERIFICATION_STATUSES.BLOCKED]: [VERIFICATION_STATUSES.PENDING],
} as const satisfies Record<VerificationStatus, readonly VerificationStatus[]>;

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    typeof value === 'string' && (ALL_VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  return (VERIFICATION_TRANSITIONS[from] as readonly VerificationStatus[]).includes(to);
}

export function assertVerificationTransition(
  from: VerificationStatus,
  to: VerificationStatus,
): void {
  if (!canTransitionVerification(from, to)) {
    throw new Error(`Illegal verification transition: ${from} -> ${to}`);
  }
}

export const OPERATIONAL_VERIFICATION_STATUS = VERIFICATION_STATUSES.APPROVED;

export function isBusinessOperational(status: VerificationStatus): boolean {
  return status === OPERATIONAL_VERIFICATION_STATUS;
}

export const VERIFICATION_REASON_CODES = {
  DOCUMENTS_MISSING: 'documents_missing',
  DOCUMENTS_UNREADABLE: 'documents_unreadable',
  DOCUMENTS_MISMATCH: 'documents_mismatch',
  DUPLICATE_ENTITY: 'duplicate_entity',
  SANCTIONS_MATCH: 'sanctions_match',
  POLICY_VIOLATION: 'policy_violation',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
} as const;

export type VerificationReasonCode =
  (typeof VERIFICATION_REASON_CODES)[keyof typeof VERIFICATION_REASON_CODES];
