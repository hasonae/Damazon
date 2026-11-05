export const API_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  ILLEGAL_STATE_TRANSITION: 'ILLEGAL_STATE_TRANSITION',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  ZONE_NOT_COVERED: 'ZONE_NOT_COVERED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export const HTTP_STATUS_BY_ERROR_CODE = {
  [API_ERROR_CODES.VALIDATION_FAILED]: 400,
  [API_ERROR_CODES.UNAUTHENTICATED]: 401,
  [API_ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [API_ERROR_CODES.ACCOUNT_LOCKED]: 403,
  [API_ERROR_CODES.ACCOUNT_NOT_VERIFIED]: 403,
  [API_ERROR_CODES.PERMISSION_DENIED]: 403,
  [API_ERROR_CODES.RESOURCE_NOT_FOUND]: 404,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.RATE_LIMITED]: 429,
  [API_ERROR_CODES.BUSINESS_RULE_VIOLATION]: 422,
  [API_ERROR_CODES.ILLEGAL_STATE_TRANSITION]: 409,
  [API_ERROR_CODES.PAYMENT_FAILED]: 402,
  [API_ERROR_CODES.PAYMENT_VERIFICATION_FAILED]: 409,
  [API_ERROR_CODES.SUBSCRIPTION_REQUIRED]: 402,
  [API_ERROR_CODES.ZONE_NOT_COVERED]: 422,
  [API_ERROR_CODES.OUT_OF_STOCK]: 409,
  [API_ERROR_CODES.PAYLOAD_TOO_LARGE]: 413,
  [API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 415,
  [API_ERROR_CODES.INTERNAL_ERROR]: 500,
  [API_ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
} as const satisfies Record<ApiErrorCode, number>;

export interface ApiFieldViolation {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}

export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: readonly ApiFieldViolation[];
  readonly traceId?: string;
}

export interface ApiSuccessBody<TData> {
  readonly data: TData;
  readonly meta?: ApiResponseMeta;
}

export interface ApiResponseMeta {
  readonly requestId: string;
  readonly timestamp: string;
}

export type ApiResponse<TData> =
  | { readonly success: true; readonly body: ApiSuccessBody<TData>; readonly meta: ApiResponseMeta }
  | { readonly success: false; readonly error: ApiErrorBody; readonly meta: ApiResponseMeta };

export function httpStatusForErrorCode(code: ApiErrorCode): number {
  return HTTP_STATUS_BY_ERROR_CODE[code];
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && value in HTTP_STATUS_BY_ERROR_CODE;
}

export function successResponse<TData>(data: TData, meta: ApiResponseMeta): ApiResponse<TData> {
  return { success: true, body: { data }, meta };
}

export function errorResponse(error: ApiErrorBody, meta: ApiResponseMeta): ApiResponse<never> {
  return { success: false, error, meta };
}
