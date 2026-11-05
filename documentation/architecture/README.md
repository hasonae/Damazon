# Architecture Decision Records

This directory holds the Architecture Decision Records for Damazon. Every significant
structural, dependency, or platform decision is captured here before the code that
depends on it is considered settled.

## Format

Each file is named `NNNN-short-slug.md` and follows this structure:

| Section                 | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| Title                   | The decision in one sentence, in the imperative.                     |
| Status                  | `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, or `Deprecated`.   |
| Date                    | ISO-8601 decision date.                                              |
| Context                 | The forces that made a decision necessary.                           |
| Decision                | What was decided, stated as a rule.                                  |
| Consequences            | What becomes easier, what becomes harder, and what is now forbidden. |
| Alternatives considered | Options rejected and why.                                            |

## Conventions

- Records are immutable once `Accepted`. A reversal is a new record that supersedes
  the old one; the old record is edited only to point at its successor.
- Consequences must include at least one negative consequence. A record with no
  downside was not a real decision.
- Cross-references use `ADR-NNNN`. Domain decisions that follow the business
  requirements document cite the relevant part instead.

## Index

| ADR                                                         | Title                                                     | Status   | Date       |
| ----------------------------------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| [ADR-0001](adr/0001-npm-workspaces-monorepo.md)             | Use npm workspaces for the monorepo                       | Accepted | 2026-10-05 |
| [ADR-0002](adr/0002-dual-cjs-esm-shared-packages.md)        | Ship shared packages as dual CJS/ESM builds               | Accepted | 2026-10-05 |
| [ADR-0003](adr/0003-money-as-integer-minor-units.md)        | Represent money as integer minor units                    | Accepted | 2026-10-05 |
| [ADR-0004](adr/0004-scrypt-password-hashing.md)             | Hash passwords with Node built-in scrypt                  | Accepted | 2026-10-05 |
| [ADR-0005](adr/0005-jwt-access-opaque-refresh.md)           | Use JWT access tokens with opaque rotating refresh tokens | Accepted | 2026-10-05 |
| [ADR-0006](adr/0006-admin-department-permissions.md)        | Authorize admins by department, not by role               | Accepted | 2026-10-05 |
| [ADR-0007](adr/0007-order-status-machine-brd-authority.md)  | Treat the BRD order lifecycle as the status authority     | Accepted | 2026-10-05 |
| [ADR-0008](adr/0008-separate-admin-pwa.md)                  | Ship the admin console as an isolated PWA                 | Accepted | 2026-10-05 |
| [ADR-0009](adr/0009-prisma-single-schema-modular-client.md) | Use one Prisma schema with a modular client               | Accepted | 2026-10-05 |
| [ADR-0010](adr/0010-zod-validation-at-the-boundary.md)      | Validate every request and response with Zod              | Accepted | 2026-10-05 |
| [ADR-0011](adr/0011-vitest-test-runner.md)                  | Run unit tests on Vitest with per-workspace configs       | Accepted | 2026-10-05 |
| [ADR-0012](adr/0012-flat-eslint-config-monorepo.md)         | Lint the monorepo with a single flat ESLint config        | Accepted | 2026-10-05 |
