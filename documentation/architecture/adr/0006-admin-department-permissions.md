# ADR-0006: Authorize administrators by department, not by role

- Status: Accepted
- Date: 2026-10-05

## Context

The admin console is a separate PWA with its own staff roles. Staff permissions
are not a simple role-to-capability list: the platform needs an operator who can
see orders but not payouts, a finance reviewer who can approve refunds but not
edit catalog, and a super administrator who can do both. Expressing this as
distinct top-level roles (`admin_finance`, `admin_orders`, `super_admin`) would
multiply roles combinatorially and make onboarding a role-assignment problem
rather than a department-membership problem.

`AdminProfile.department` already exists on the staff record.

## Decision

Authorization is resolved from the administrator's `department`, not from a
single admin role:

- `AdminProfile.department` holds one or more departments
  (`orders`, `finance`, `catalog`, `support`, `moderation`, `partners`,
  `marketing`, `system`).
- The permission resolver maps department membership to a permission set at
  request time; `super_admin` is the single department that resolves to the full
  set.
- `ROLE_PERMISSIONS.admin` in `@damazon/shared-types` is intentionally **empty**.
  An account holding only the `admin` role, with no department membership,
  resolves to no administrative permissions at all.

`PermissionsGuard` evaluates `@RequirePermissions(...)` declarations against the
resolved permission set, and every admin controller endpoint declares its
required permissions explicitly. There is no implicit allow for "any staff
account".

## Consequences

Granting access is a membership change, so onboarding and offboarding are single
field edits, and the audit log can attribute each administrative action to a
department. An admin account with no department is inert by construction, which
fails safe. The cost is that adding a new capability means editing both the
department-to-permission map and the controller decorator, and the map is a
single shared file that becomes a hot spot for merge conflicts as the team grows.
Because permissions are resolved per request from the database-backed principal,
a department change takes effect on the next request rather than at token
expiry.

## Alternatives considered

- **Role-permission matrix with many admin roles.** Rejected: combinatorial
  role growth, and every new capability would require a new role and a new
  onboarding path.
- **Coarse `admin` boolean.** Rejected: gives every staff member every
  capability, which fails the requirement for separated finance and catalog
  access.
- **Per-endpoint hand-written checks.** Rejected: not auditable, and easy to
  omit a check on a new endpoint.
