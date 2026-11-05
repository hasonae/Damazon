# ADR-0008: Ship the admin console as an isolated PWA

- Status: Accepted
- Date: 2026-10-05

## Context

Damazon has two distinct user populations. Customers, merchants, restaurant
operators, delivery-company staff, and drivers share one adaptive interface that
changes mode by active role. Administrators need a different product entirely:
dense tables, keyboard-driven workflows, approval queues, audit review, and
financial reconciliation, with no consumer features at all.

Serving both from one bundle has a specific failure mode: any code reachable from
the customer bundle can be reached by an administrator's browser session, and a
single mis-scoped route exposes administrative data to a consumer-facing client.

## Decision

`apps/admin-pwa` is a separate Vite application with its own manifest, service
worker, origin, and bundle. It shares only the packages that contain no
administrative logic:

- `@damazon/shared-types` (roles, permissions, money, API envelopes),
- `@damazon/utilities`,
- `@damazon/api-client`,
- `@damazon/design-system`, restricted to its neutral primitives and
  layout tokens.

The admin app has no route, no navigation entry, and no feature flag that links
it to the customer app, and the customer app contains no administrative code at
all. The API remains the actual enforcement boundary: an admin endpoint rejects a
consumer token regardless of which bundle issued it, because admin permission is
resolved from `AdminProfile.department` (see ADR-0006).

The two visual languages are also deliberately different. The consumer-facing
app uses the water/liquid-glass treatment, translucency, and motion. The admin
console is professional, minimal, high-density, and animation-free, because it is
used for hours at a time in a back-office context.

## Consequences

A consumer-facing bundle can never contain administrative code, which removes a
whole class of accidental exposure and shrinks the consumer bundle. Admin
changes deploy independently of customer-facing releases. The cost is duplicated
application scaffolding: two build configs, two manifests, two service workers,
and two test harnesses. Any genuinely shared UI must be raised into
`@damazon/design-system` first, and keeping that package free of
role-specific styling is a rule reviewers must enforce.

## Alternatives considered

- **Role-gated routes inside the single PWA.** Rejected: every administrative
  route and its dependencies would still ship to consumer browsers, and route
  guards are a client-side convenience rather than a security control.
- **A server-rendered admin site.** Rejected: it breaks the single toolchain and
  design-system story established for the rest of the platform, and adds a
  second rendering stack to maintain.
- **Embedding the admin console in the backend's static assets.** Rejected: it
  couples the deployable artifact of the API to an unrelated UI and makes
  independent rollback impossible.
