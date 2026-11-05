# Security

## Threat Model

The platform holds payment-adjacent records, verified phone numbers, delivery
addresses, and administrative actions. The assets worth attacking are, in order:

1. An administrator session or a merchant session.
2. Stored credentials, in bulk or individually.
3. Order and payment records.
4. Personal data: phone numbers and addresses.
5. Availability of the ordering path during peak hours.

The realistic attackers are a credential-stuffing operator, a malicious
merchant attempting to read a competitor's orders, a customer attempting to
modify someone else's cart or order, and a compromised staff account.

## Authentication

Password hashing uses Node's built-in `scrypt` at `N=2^16`, `r=8`, `p=1` with a
per-password random salt, encoded as `scrypt$N$r$p$salt$hash` so parameters
travel with the hash. Verification uses `timingSafeEqual`. Passwords older than
`PASSWORD_MAX_AGE_DAYS` are flagged for rotation at login (ADR-0004).

Administrative login accepts a username, email, or phone number. To provision
the approved super-admin account, first deploy pending database migrations,
then run `admin:set-credentials` with `ADMIN_USERNAME` and `ADMIN_PASSWORD`
supplied as process secrets. Initial provisioning also requires
`ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, and `ADMIN_PHONE` so the administrator
has a real recovery contact; an existing super-admin only has its username and
password rotated. The command refuses ambiguous administrator state, hashes
the password with the configured scrypt policy, and does not print credentials.
Never put production credentials in frontend code, source control, or build-time
`VITE_` variables.

Sessions are a JWT access token plus a rotating, server-recorded refresh token.
Access tokens are short-lived (default 900 s) and carry `sub`, `sid`, `role`,
`bid`, and a `typ` discriminator. Refresh tokens are stored only as SHA-256
digests; presenting a superseded token revokes the entire session as replay
detection. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must differ, and
production startup refuses template placeholder values (ADR-0005).

Login failures are counted per account; exceeding
`LOGIN_MAX_FAILED_ATTEMPTS` locks the account for
`LOGIN_LOCK_DURATION_SECONDS`. The API also enforces a global per-IP request
limit and a tighter per-IP limit on authentication routes. Development uses
in-process memory; staging and production use separate Redis-backed global and
authentication stores. Redis is required at startup in those environments, so
the API does not silently fall back to per-process limits. When behind a
reverse proxy, set `TRUST_PROXY_HOPS` to the known proxy-chain length and block
direct public access so clients cannot spoof forwarded IP headers.

Registration verifies email through a short-lived, single-use link delivered
by the API's configured SMTP service. Password recovery uses the same delivery
channel and an independent one-time link; it does not require SMS or Supabase
Auth. Links expire after 15 minutes, are stored as keyed digests, and are
consumed atomically. Invalid attempts are capped, and repeated link requests
are rate-limited. Production and staging must configure and test SMTP delivery;
the application cannot prove that a provider will accept or deliver mail from a
configuration-only health check.

Sign-in checks the existing scrypt password hash after email verification and
continues to enforce account lockout and shared request-rate limits. Phone
numbers are collected for account contact and delivery but are not claimed as
verified; no SMS verification is performed.

## Authorization

Two independent gates:

**Role** decides the mode of a session. `customer`, `merchant`, `restaurant`,
`delivery_company`, `driver`, and `admin` are held on `UserRoleAssignment`, and
the session records the active one. A role switch mints a new access token, so
the claim set always matches the current mode.

**Permission** decides the specific action. `@damazon/shared-types` holds the
role-to-permission map and the department-to-permission map. Administrative
authority resolves from `AdminProfile.department`; the `admin` role alone maps
to an empty permission set (ADR-0006).

`PermissionsGuard` runs on every request and reads `@RequirePermissions(...)`
from the handler. There is no implicit allow: an endpoint with no decorator is
open to any authenticated principal, which is why every non-public controller
method declares its requirement explicitly.

**Tenant isolation.** Business-owned queries filter on the principal's
`activeBusinessId`. A merchant cannot read another merchant's orders even with a
correct role, because the business identifier comes from the signed token rather
than from request parameters. Database row-level security is planned as
additional hardening, not the primary control.

**Client-side guards are cosmetic.** Both PWAs hide actions the principal lacks,
but the API is the enforcement boundary. A hidden button is a usability feature.

## Input Validation

Every `body`, `query`, and `params` is parsed by `ZodValidationPipe` against a
schema declared in `@damazon/shared-types` before the handler runs. Failures
return 400 with per-field details and never reach a service or the database.
Response shapes are validated in development and test so a malformed payload
fails loudly (ADR-0010).

## Data Protection in Transit and at Rest

All endpoints are HTTPS in staging and production; HSTS is set by Helmet. The
refresh token is delivered only in an `HttpOnly`, `SameSite=Strict` cookie by
browser clients; the cookie is `Secure` in production and scoped to the auth
routes. It is never returned in JSON or written to `localStorage`. Both PWAs
keep only the short-lived access token in memory and exchange the cookie for a
fresh access token on reload. The apps and API must share a site so browsers
send the strict cookie. Passwords and token digests
are never logged. Log statements reference user IDs, not phone numbers or
addresses.

Money is stored as integer minor units so totals reconcile exactly
(ADR-0003). Checkout currently supports cash on delivery only; its request
schema rejects online payment methods. Payment is recorded as pending at order
creation. A driver must explicitly confirm collection at delivery; the payment
status and append-only payment log are updated in the same transaction as
delivery completion. This is an operational record, not independent proof of
cash receipt or a settlement/reconciliation workflow between the driver,
delivery company, and platform.

Business approval and cash subscription confirmation are separate audited
administrative actions. A business is not publicly visible unless approved and
covered by an in-date active subscription. Subscription cash receipts create a
paid invoice, payment record, append-only payment log, and audit entry in one
transaction. Reminder notifications use a unique subscription key to prevent
duplicates. A server-side lifecycle sweep expires subscriptions and suspends
businesses; expired businesses remain inaccessible to public catalog and
checkout queries even before the next sweep executes.

## Auditability

`AuditLog` is append-only and records the acting principal, the action, the
target type and identifier, and a JSON diff. Administrative reads of customer
data are logged as well as writes, because the sensitive operation for staff is
often looking rather than changing.

`OrderStatusHistory` and `PaymentLog` are the domain-level equivalents for
order and payment state, and the customer-facing order timeline is a projection
of `OrderStatusHistory` rather than a separately maintained value.

## Error Handling

`AllExceptionsFilter` normalizes every thrown value into the documented error
envelope with a machine-readable `code`. Stack traces, SQL text, and Prisma error
internals are logged server-side and never returned. A 404 is returned when a
resource exists but is not visible to the principal, so the API does not
confirm the existence of other tenants' records.

## Environment and Secrets

`environmentSchema` validates every variable at startup; the process refuses to
boot on an invalid configuration. Production additionally rejects template
placeholder JWT secrets. `.env` is never committed; `.env.example` carries
placeholders only.

## Rate Limiting

Two tiers: a global limit of `RATE_LIMIT_MAX_REQUESTS` per
`RATE_LIMIT_WINDOW_MS`, and a tighter `AUTH_RATE_LIMIT_MAX_REQUESTS` on the
authentication routes, because password verification is intentionally expensive
and is itself an amplification vector.

## Reporting

Suspected vulnerabilities should be reported privately to the platform
operators rather than through a public issue. Include the affected endpoint, the
role used, and a reproduction. Do not include real customer data.
