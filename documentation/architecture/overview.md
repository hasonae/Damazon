# Damazon Architecture

Damazon is a multi-sided marketplace for the Syrian market. It connects
customers with merchants, restaurants, delivery companies, and drivers, and it
gives platform staff a separate administrative console.

## System Context

```
                    ┌───────────────────────────────┐
                    │        Damazon Platform       │
                    │                               │
  customers ───────▶│  apps/customer-pwa (PWA)      │◀────── merchants
  drivers   ───────▶│  apps/admin-pwa    (PWA)      │◀────── restaurants
                    │  apps/backend      (NestJS)   │◀────── delivery cos.
                    │  packages/*       (shared)    │◀────── platform staff
                    └───────────┬───────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        PostgreSQL 16      Redis 7          Object storage
          (system of         (cache,          (media)
           record)           queues)
```

## Applications

| Workspace           | Purpose                                                                             | Runtime               |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `apps/customer-pwa` | Adaptive PWA for customer, merchant, restaurant, delivery-company, and driver modes | Vite + React, browser |
| `apps/admin-pwa`    | Isolated administrative console; no consumer code ships in it                       | Vite + React, browser |
| `apps/backend`      | REST API, authentication, domain rules, persistence                                 | NestJS 11 on Node 22  |

The customer PWA changes mode by the account's active role. A single account can
hold several roles and switch between them at runtime; the API issues a new
access token on every switch, and the token's `role` and `bid` claims are the
authority for what that session may do.

## Shared Packages

| Package                   | Contents                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@damazon/shared-types`   | Roles, permissions, money, order status machine, delivery tasks, API envelopes, pagination, locale, realtime event contracts |
| `@damazon/utilities`      | Result type, Syrian phone normalization, text helpers, async helpers                                                         |
| `@damazon/design-system`  | Design tokens and UI primitives; neutral, no role-specific styling                                                           |
| `@damazon/api-client`     | Typed HTTP client generated from the shared Zod contracts                                                                    |
| `@damazon/configurations` | Shared build, lint, and toolchain presets                                                                                    |

Shared packages ship dual CommonJS/ESM builds with explicit `.js` extensions in
relative imports (ADR-0002).

## Layering Inside the Backend

Each functional area is a NestJS module with four layers:

- **Controller** — declares the route, its Zod request schema, and the
  `@RequirePermissions` set. No business logic.
- **Service** — domain rules and orchestration. Owns transactions.
- **Repository** — Prisma queries for one aggregate.
- **Presentation mappers** — converts persistence records into the transport
  shapes declared in `@damazon/shared-types`.

Cross-cutting concerns are registered once at the root as
`APP_FILTER`/`APP_INTERCEPTOR`/`APP_GUARD` providers: the exception filter that
normalizes every error into one envelope, the request-context and
response-envelope interceptors, and the principal-resolver, JWT, and permissions
guards that run in that order on every request.

## Request Lifecycle

1. `RequestContextInterceptor` assigns a request ID and start time.
2. `PrincipalResolverGuard` resolves the bearer token, if present, into a
   principal. It never rejects.
3. `JwtAuthGuard` rejects unauthenticated requests to protected routes.
4. `PermissionsGuard` evaluates `@RequirePermissions` against the principal's
   resolved permission set (ADR-0006).
5. `ZodValidationPipe` validates `body`, `query`, and `params`.
6. The handler runs.
7. `ResponseEnvelopeInterceptor` wraps the result in
   `{ success, body, meta: { requestId, timestamp } }`.
8. `AllExceptionsFilter` converts anything thrown into
   `{ success: false, error: { code, message, details?, traceId }, meta }`.

## Data Model Shape

The schema is one Prisma schema with roughly forty models grouped by area:
identity and sessions, geography, businesses and subscriptions, catalog and
menu, carts, orders and order events, delivery tasks and fleet, payments,
reviews, favorites, coupons, messaging, notifications, administration and audit
logs, settings, analytics, and support. See
[ADR-0009](../architecture/adr/0009-prisma-single-schema-modular-client.md) and
`documentation/database/`.

## Cross-Cutting Rules

- Money is integer minor units in `BigInt`; formatting goes through the shared
  registry (ADR-0003).
- Order status changes only through the shared state machine (ADR-0007).
- Administrative access is resolved from `AdminProfile.department`; the `admin`
  role alone grants nothing (ADR-0006).
- Every request and response is validated with Zod at the boundary (ADR-0010).
- The UI is Arabic-first RTL; money is rendered with Latin digits.

## Decisions

See `documentation/architecture/README.md` for the ADR index.
