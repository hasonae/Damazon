# ADR-0011: Run unit tests on Vitest with per-workspace configs

- Status: Accepted
- Date: 2026-10-05

## Context

The repository is an npm-workspace monorepo (ADR-0001) with shared packages that
are consumed three different ways: CommonJS by the NestJS backend through
`tsc`, ESM by Vite-bundled PWAs, and as source by the test runner itself. A
single global test runner has to reconcile those resolution modes, and the
backend also needs integration and end-to-end tiers that hit a real PostgreSQL
instance and a booted Nest application.

The existing passing coverage already includes the pure domain logic that matters
most: the money registry and minor-unit arithmetic, Syrian phone normalization,
the order status state machine, permission and role resolution, and the
security primitives.

## Decision

Vitest is the unit-test runner for every workspace, configured per workspace so
each one resolves its own sources the way its consumers do:

- `packages/shared-types` and `packages/utilities` test their TypeScript source
  directly, which keeps coverage mapped to the files developers edit.
- `apps/backend` uses a backend config for unit tests and a separate
  `vitest.e2e.config.ts` for the tier that boots the Nest application against a
  live database. The two tiers do not share a config, so a unit-test run never
  requires a database.
- Coverage is `@vitest/coverage-v8`, invoked by the root `test:cov` script.
- Every workspace defines `test` as `vitest run --passWithNoTests` so that a
  workspace without tests yet does not break the root `npm test` fan-out.

Root scripts (`test`, `test:cov`, `typecheck`, `lint`, `build`, `verify`) fan out
across workspaces so CI and a developer machine run the same command.

Tests that need no external service are the default. Any test that requires
PostgreSQL or Redis belongs in the e2e tier and is skipped when the service is
unreachable, rather than being made to pass with a fake database.

## Consequences

Coverage maps to source rather than to build output, and the shared packages can
be tested once and trusted by all three consumers. Running the unit suite is fast
and needs no infrastructure, which keeps it usable as a pre-commit gate. The
cost is per-workspace configuration: a new workspace must add its own Vitest
config and a `test` script, and root `verify` must be extended if the workspace
needs a lint or typecheck step of its own. `--passWithNoTests` means an empty
suite is reported as passing, so a workspace can silently have no coverage until
someone writes tests for it.

## Alternatives considered

- **Jest.** The NestJS default, but its ESM support requires configuration
  gymnastics in every shared package, and its transform pipeline is slower than
  Vitest's for the TypeScript-only packages here.
- **A single root Vitest config with projects.** Viable, but the projects
  feature centralizes per-workspace resolution rules in the root, which is where
  the CommonJS/ESM split is most likely to be misconfigured.
- **Node's built-in test runner.** Zero dependencies, but no first-class mocking,
  no coverage driver, and awkward decorator-aware TypeScript loading for the
  NestJS services.
