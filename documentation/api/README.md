# API Conventions

Base URL in development: `http://localhost:3000/api/v1`.

All endpoints are JSON over HTTP. Every response uses one of two envelopes.

## Success Envelope

```json
{
  "success": true,
  "body": { "...": "payload" },
  "meta": {
    "requestId": "b3f1c0a2-6d1e-4f8a-9c33-1f0a2b7c5d10",
    "timestamp": "2026-10-05T10:50:49.673Z",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 137,
      "totalPages": 7
    }
  }
}
```

`meta.pagination` is present only on paginated collections.

## Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "field": "body.identifier", "message": "Required", "code": "invalid_type" }],
    "traceId": "fd97f010-2f50-4160-ad8a-59ae8437181c"
  },
  "meta": {
    "requestId": "fd97f010-2f50-4160-ad8a-59ae8437181c",
    "timestamp": "2026-10-05T10:48:10.552Z"
  }
}
```

`error.details` is present only for validation failures. `traceId` always equals
`meta.requestId`.

## Error Codes

| Code                          | HTTP | Meaning                                                             |
| ----------------------------- | ---- | ------------------------------------------------------------------- |
| `VALIDATION_FAILED`           | 400  | Request failed schema validation                                    |
| `UNAUTHENTICATED`             | 401  | Missing, malformed, or expired token                                |
| `INVALID_CREDENTIALS`         | 401  | Login identifier or password did not match                          |
| `ACCOUNT_LOCKED`              | 403  | Too many failed attempts; retry after the lock window               |
| `ACCOUNT_NOT_VERIFIED`        | 403  | Account verification is required                                    |
| `PERMISSION_DENIED`           | 403  | Authenticated but the resolved permission set lacks the requirement |
| `RESOURCE_NOT_FOUND`          | 404  | Resource does not exist, or is not visible to this principal        |
| `SUBSCRIPTION_REQUIRED`       | 402  | Business has no active subscription for this action                 |
| `PAYMENT_FAILED`              | 402  | A payment operation failed                                          |
| `CONFLICT`                    | 409  | Unique constraint conflict                                          |
| `ILLEGAL_STATE_TRANSITION`    | 409  | The order state machine rejected the transition                     |
| `PAYMENT_VERIFICATION_FAILED` | 409  | Callback did not match a recorded attempt                           |
| `OUT_OF_STOCK`                | 409  | Insufficient stock for a variant                                    |
| `PAYLOAD_TOO_LARGE`           | 413  | Upload exceeds the permitted size                                   |
| `UNSUPPORTED_MEDIA_TYPE`      | 415  | Upload type is not permitted                                        |
| `BUSINESS_RULE_VIOLATION`     | 422  | Well-formed but rejected by a domain rule                           |
| `ZONE_NOT_COVERED`            | 422  | Delivery address is outside the business's zones                    |
| `RATE_LIMITED`                | 429  | Rate limit exceeded; see `Retry-After`                              |
| `INTERNAL_ERROR`              | 500  | Unexpected failure; details are logged, never returned              |
| `SERVICE_UNAVAILABLE`         | 503  | A required dependency is unavailable                                |

The code-to-status mapping is declared once in `HTTP_STATUS_BY_ERROR_CODE` in
`@damazon/shared-types`, so the client and server cannot disagree about it.

Internal failures never leak stack traces or database messages to the client.

## Authentication

`Authorization: Bearer <accessToken>` on every protected endpoint.

Access tokens are short-lived JWTs (default 900 s) carrying `sub`, `sid`,
`role`, `bid`, and `typ: "access"`. A session is revoked server-side; access
token validity is additionally bounded by its TTL. Refresh tokens rotate on
every use and are stored only as a SHA-256 hash; replaying a superseded refresh
token revokes the whole session (ADR-0005).

Protected endpoints require the access token in the `Authorization` bearer
header. Browser clients keep it in memory and send the refresh token only in
the API's `HttpOnly` cookie.

### `POST /auth/register`

```json
{
  "phone": "0941000001",
  "password": "...",
  "firstName": "Customer",
  "lastName": "Test",
  "email": "customer@example.com",
  "locale": "ar"
}
```

Phone numbers are normalized to `+963…` E.164 before storage; `0941000001` and
`+963941000001` are the same account. Syrian mobile prefix validation follows
the [ITU-published Syrian numbering plan](https://www.itu.int/oth/T02020000C9/en),
which lists 094 among active mobile operator codes. Email is required. The response contains
the email and link expiry, but no session is created until email verification
completes. The API sends a short-lived, single-use email link through the
configured SMTP service. Phone numbers are not independently verified.

### `POST /auth/verify-email`

Body `{ "challengeId": "uuid", "token": "opaque-link-token" }`. A successful
verification creates the session and sets the rotating refresh token only as
an `HttpOnly`, `SameSite=Strict` cookie (and `Secure` in production). The
customer app's `/verify-email` page submits this payload after the user opens
the emailed link.

### `POST /auth/resend-email-verification`

Body `{ "email": "customer@example.com" }`. Returns the same accepted response
whether or not that address has a pending verification. Resends are limited to
one per minute for pending accounts.

### `POST /auth/login`

```json
{
  "identifier": "0941000001",
  "password": "..."
}
```

`identifier` accepts a phone number in any accepted local or E.164 form, or an
email address. Successful response:

```json
{
  "accessToken": "…",
  "accessTokenExpiresIn": 900,
  "sessionId": "77fc9f12-35d0-4aeb-b056-d1ab5364256f",
  "user": {
    "id": "0a613404-…",
    "firstName": "Customer",
    "lastName": "Test",
    "phone": "+963941000001",
    "email": "customer@damazon.test",
    "avatarUrl": null,
    "locale": "ar",
    "status": "ACTIVE",
    "roles": ["customer"],
    "activeRole": "customer",
    "activeBusinessId": null,
    "adminDepartments": [],
    "permissions": ["products:read", "orders:create", "…"],
    "phoneVerified": true,
    "emailVerified": true,
    "createdAt": "2026-10-05T10:24:37.288Z"
  }
}
```

`permissions` is already resolved server-side, so the UI can decide what to show
without reimplementing the role and department rules.

## Business approval and cash subscriptions

`POST /businesses` creates an application in `PENDING` / `DRAFT`; it does not
activate a business role. Administration reviews it using
`GET /admin/businesses/review`, then uses `POST /admin/businesses/:id/approve`
or `POST /admin/businesses/:id/reject` with `{ "reason": "..." }`. Approval
enables the business role but keeps the business in draft until cash is
recorded. These actions require `businesses:approve`.

An administrator records cash physically received using
`POST /admin/businesses/:id/cash-subscription` with
`{ "cashReceived": true, "note": "optional receipt detail" }`. This transaction
creates the 500 SYP / 30-day subscription, paid invoice, successful cash
payment, payment log, owner notification, and audit event. The route requires
`subscriptions:manage` and `invoices:manage`; it is not a customer checkout
method. Renewals paid before expiry are scheduled to start after the current
period. The same renewal cannot be recorded twice.

The backend sends one in-app reminder within the six-day window. A background
subscription sweep runs every five minutes, expires periods at their end, and
suspends approved businesses without a current paid period. Recording a new
cash period reactivates a subscription-suspended business. Public store and
product queries also require an active, in-date subscription, so expiry does
not depend on the sweep timing to hide a business.

### `POST /auth/refresh`

No JSON body is required. Send the refresh cookie with credentials enabled.
The API rotates that cookie and returns a new access token. Presenting a token
that is no longer the active one for that session revokes the session and
returns `UNAUTHENTICATED`.

### `POST /auth/switch-role`

Body `{ "role": "merchant" }`. Requires the account to hold the role. Returns a
fresh access token and updated user payload whose `role` and `bid` claims
reflect the new mode. The refresh cookie is rotated as well, so later refreshes
preserve the selected role and business.

### `POST /auth/logout` and `POST /auth/logout-all`

Revoke the current session, or every session for the user, and clear the refresh
cookie.

### `GET /auth/me`

Returns the resolved principal and permission set.

## Business onboarding and seller orders

`POST /businesses` is available to an authenticated customer account for
submitting a merchant, restaurant, or delivery-company application. Submission
creates a pending business and role assignment; it does not approve the business
or grant the business-role session. Platform review must approve the application
before the owner can switch into that role.

Once approved and operating in its merchant or restaurant role:

- `GET /orders/business` lists orders for the active business in the signed
  session, with the standard `limit`, `cursor`, and optional `status` filters.
- `POST /orders/business/{id}/status` accepts `{ "status": "preparing" }` or
  `{ "status": "ready" }`. The server verifies ownership, validates the shared
  order-state transition, and records the seller action in order history.
- Marking an order `ready` creates its delivery task in the same transaction,
  using the business and destination coordinates already recorded on the order.

The active business ID is taken from the authenticated session, not accepted
from a query parameter. Sellers cannot use this endpoint to access another
business's orders or to mark payment, delivery, refund, or cancellation states.

## Delivery operations

All delivery routes require an authenticated, approved role and use the active
role in the signed session:

- `GET /delivery/tasks` lists tasks for the signed-in driver, or for the active
  delivery company plus unassigned ready orders in its configured coverage
  cities. An optional `status` filter is supported.
- `GET /delivery/drivers` lists only drivers belonging to the active operational
  delivery company.
- `POST /delivery/tasks/assign` accepts `{ "taskId": "...", "driverId": "..." }`.
  The driver must belong to that company and be available. Task claiming, driver
  reservation, order transition, and order history are committed atomically.
- `PATCH /delivery/tasks/{id}/status` accepts a task status for the driver's own
  assigned task. The shared task and order state machines are both enforced.
- `GET` and `PATCH /delivery/driver/availability` read or update the driver's
  availability; `PATCH /delivery/driver/location` records coordinates only
  after the driver explicitly shares their location.

Delivery task status changes are scoped to the authenticated driver. Company
task discovery is limited to its own work and unassigned tasks in configured
coverage cities; the active company is resolved from the signed session, never
from a caller-supplied company identifier.

## Administrative operations

- `GET /admin/dashboard` requires both `orders:read` and `businesses:read`. It
  returns persisted order/business counts and the ten most recent orders.
- `GET /admin/orders` requires `orders:read` and supports the standard
  cursor-based `limit`, `cursor`, and optional `status` filters.
- `GET /admin/businesses/review` requires `businesses:read` and returns submitted
  applications together with document and active-subscription readiness.

The console displays actual API data and reports load failures. Business review
is currently read-only: document upload and approval actions are not exposed
until a secure document-upload flow and its review/audit lifecycle are
implemented.

## Payment availability

Cash on delivery is the only checkout method currently enabled. ShamCash/QR
checkout is rejected by the checkout contract. The customer UI offers only
cash on delivery; at delivery, the driver confirms collection and the API
updates the order and payment audit log transactionally.

## Roles

`customer`, `merchant`, `restaurant`, `delivery_company`, `driver`, `admin`.

`driver` is distinct from `delivery_company`: a driver is an individual courier,
a delivery company is the operator that owns vehicles and employs or contracts
couriers. Administrative authority comes from `AdminProfile.department`, never
from the `admin` role alone (ADR-0006).

## Money on the Wire

Monetary values are **decimal strings in minor units**: `"1250000"` is
1,250,000 minor units. SYP has zero minor-unit digits, so that string is
1,250,000 SYP. Clients must not do arithmetic on these strings; they call
`formatMinorUnits` from `@damazon/shared-types` (ADR-0003).

## Pagination

Collections are cursor-paginated, not offset-paginated. Query parameters:

| Parameter | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `limit`   | Page size. Defaults to 20, clamped to 1–100 by `clampPageSize` |
| `cursor`  | Opaque cursor from the previous page's `meta.nextCursor`       |

The paginated payload is:

```json
{
  "items": [],
  "meta": { "limit": 20, "hasMore": true, "nextCursor": "…", "totalCount": 137 }
}
```

`totalCount` is present only where the endpoint can produce it cheaply. An
invalid cursor returns `VALIDATION_FAILED` rather than silently restarting at the
first page, because silently restarting hides a broken deep link.

Cursor pagination is preferred over `page` because order lists change while a
customer is scrolling, and offset pagination skips or repeats rows when an order
is inserted mid-scroll.

## Localization

`locale` is `ar` (default) or `en`. Timestamps are ISO-8601 UTC; the client
formats them for the active locale. Money always renders with Latin digits even
in the Arabic interface.

## Health

- `GET /health` — liveness plus dependency checks.
- `GET /health/ready` — readiness; returns 503 when a required dependency is
  unreachable.

## Rate Limits

Global: `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` per client.
Authentication endpoints use the tighter `AUTH_RATE_LIMIT_MAX_REQUESTS` because
password verification is deliberately expensive (ADR-0004). Exceeding a limit
returns 429 with `Retry-After`.
