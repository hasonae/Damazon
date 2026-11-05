# ADR-0009: Use one Prisma schema with a modular client

- Status: Accepted
- Date: 2026-10-05

## Context

The data model spans roughly forty models across identity, geography,
businesses, subscriptions, catalog, menus, carts, orders, delivery, payments,
reviews, coupons, messaging, notifications, administration, audit logs,
settings, analytics, and support. Every application reads a subset of them, and
the backend modules must not each own a private database.

Splitting into multiple schemas or multiple Prisma clients would let teams move
fast independently, but orders, payments, delivery tasks, and business records
are densely cross-referenced, and the domain rules the shared packages enforce
(tenant isolation per business, one active cart per user, a single current
delivery task) span those boundaries.

## Decision

There is one Prisma schema at `apps/backend/prisma/schema.prisma` and one
generated client, consumed only by `apps/backend`. Modularity is expressed by
file-level organisation in the schema and by the backend's module boundaries,
not by splitting the schema.

Supporting decisions:

- Migrations live in `apps/backend/prisma/migrations`, generated with
  `prisma migrate` and committed. `prisma.config.ts` is the single place that
  loads environment variables for the Prisma CLI, resolving the repository-root
  `.env` and then an app-local `.env`, so the CLI and the running API read the
  same configuration.
- Tenant isolation for merchant, restaurant, and delivery-company data is a
  `businessId` foreign key on every owned model, enforced in the service layer
  from the authenticated principal's `activeBusinessId`. Database row-level
  security is a later hardening step, not the current mechanism.
- Money columns are `BigInt` (see ADR-0003) and timestamps are `timestamptz`.
- The seed script at `apps/backend/prisma/seed.ts` creates the reference data
  (country, cities, categories, system settings), one account per platform role,
  and a merchant, restaurant, and delivery company with catalog and fleet data,
  so every downstream phase has realistic data to develop against.

## Consequences

Referential integrity is enforced in one place, cross-domain queries are ordinary
joins, and a transaction spanning orders, payments, and delivery tasks is a
single client call. A single client is also a larger generated surface that every
backend module can reach, so discipline in the service layer is what keeps one
module from querying another's tables directly. Migrations lock the whole schema,
which means a large change to one domain stalls unrelated work during deploy.
Field renames in shared models require coordination across all consumers.

## Alternatives considered

- **Multiple Prisma schemas and clients per domain.** Rejected: the cross-domain
  joins are the normal case, not the exception, and splitting would force
  cross-schema transactions that Prisma does not support cleanly.
- **Prisma's `prisma-client-js` with no committed migrations.** Rejected:
  `db push` is not reproducible, and production schema drift would be invisible
  in review.
- **Drizzle or raw SQL.** Both are viable, but the requirement names Prisma, and
  Prisma's migration engine gives a reviewable SQL artifact per change.
