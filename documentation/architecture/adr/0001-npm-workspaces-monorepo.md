# ADR-0001: Use npm workspaces for the monorepo

- Status: Accepted
- Date: 2026-10-05

## Context

Damazon ships four applications (`customer-pwa`, `admin-pwa`, `backend`) and five
shared packages (`shared-types`, `utilities`, `design-system`, `api-client`,
`configurations`) that must version and release together. The development
environment is Windows with PowerShell, Node 25 installed locally and Node
22.11.0 pinned in `.nvmrc`.

The industry default for this shape is pnpm with its workspace protocol. pnpm is
not installed on the target machines, and adding a package manager that the
team cannot run on day one makes every setup instruction conditional on machine
state. The monorepo therefore needs a tool that is already present.

## Decision

The monorepo uses npm workspaces, declared in the root `package.json`
`workspaces` array. Packages reference each other by exact workspace version
(`"@damazon/shared-types": "0.1.0"`), which npm resolves to a symlink in
`node_modules`. A single `npm install` at the root installs every workspace and
every cross-workspace link.

Root scripts drive the whole graph: `build`, `typecheck`, `lint`, `test`, and
`verify` each fan out with `npm run <script> --workspaces --if-present`, and
build ordering is enforced by splitting `build` into `build:packages` and
`build:apps` so packages always compile before their consumers.

pnpm may be adopted later, but only behind this same script surface, so that
the developer experience does not change when it happens.

## Consequences

Every machine with Node 22.11+ can clone and run the project with no extra
tooling. `node_modules` is a single flat tree, so duplicated transitive
dependencies are possible and install size is larger than with pnpm's isolated
store. `node --watch` and `concurrently` are used for the backend dev loop
because npm has no built-in parallel script runner. Lockfile churn is noisier
than with pnpm. Adding a workspace requires editing the root `workspaces`
array by hand; there is no recursive-glob discovery.

## Alternatives considered

- **pnpm workspaces.** Preferred for isolated `node_modules` and faster
  installs, but not installed on the target machines, so every developer would
  need a toolchain bootstrap before any code could run.
- **Yarn Berry.** Same installation problem as pnpm, plus a heavier migration.
- **Independent repositories per package.** Rejected: the shared packages must
  change in lockstep with both applications, and cross-cutting refactors would
  need coordinated version bumps across five repositories.
