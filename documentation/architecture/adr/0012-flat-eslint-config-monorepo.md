# ADR-0012: Lint the monorepo with a single flat ESLint config

- Status: Accepted
- Date: 2026-10-05

## Context

The repository has three source dialects: the NestJS backend is CommonJS with
TypeScript experimental decorators and relies on `emitDecoratorMetadata`; the
shared packages are ESM with explicit `.js` extensions in relative imports; and
the PWAs are browser-targeted TSX with JSX enabled. Per-workspace lint configs
would each be correct in isolation but would drift, and a rule that matters
across the whole codebase (for example banning `any`) would end up enforced in
one place and absent in three.

## Decision

There is one flat config at the repository root, `eslint.config.mjs`, composed
with `typescript-eslint`. A single baseline applies to all TypeScript sources:

- `no-explicit-any` as an error, and `no-unused-vars` with an `^_` escape
  hatch.
- `consistent-type-imports`, so type-only imports are erased in the CJS build.
- `import/order` and `import/no-duplicates` for the shared packages and PWAs.
- `no-console` limited to `warn` and `error`, with test files and
  `prisma/seed.ts` exempted because their output is the report.

Dialect-specific overrides follow the baseline: the backend block sets
`sourceType: 'commonjs'` and disables `no-require-imports`; the
packages-and-PWAs block turns on import ordering. Generated output, migrations,
`documentation/`, and `deployment/` are ignored outright.

Each workspace keeps its own `lint` script so the root `npm run lint` can fan
out (ADR-0011), and every script resolves the same root config.

## Consequences

A rule added once applies everywhere, so `any` cannot reappear in a new
workspace, and the configuration is one file to review. The cost is that the root
config must know about each dialect: adding a workspace with a different module
target means editing the root file rather than adding a local config. The
`consistent-type-imports` rule touches a large number of existing files, which
made the first `--fix` run a large diff; it is now enforced, so subsequent
changes are small.

## Alternatives considered

- **Per-workspace `.eslintrc` files.** Rejected: identical baseline rules would
  be duplicated five times and drift immediately.
- **Biome.** Faster and simpler configuration, but it does not support the
  decorator patterns used by the NestJS services without disabling the rules that
  matter there.
- **TypeScript compiler flags only.** Rejected: the compiler cannot express
  import ordering, console restrictions, or the dialect-specific exemptions.
