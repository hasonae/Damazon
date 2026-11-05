# ADR-0002: Ship shared packages as dual CJS/ESM builds

- Status: Accepted
- Date: 2026-10-05

## Context

The backend runs as CommonJS on Node and compiles with `tsc` using
`module: CommonJS` and `moduleResolution: Node`. The PWAs are bundled by Vite,
which resolves ESM natively and performs its own dependency pre-bundling. The
same `@damazon/shared-types` types, money helpers, and API envelope contracts
must be importable by all three targets without a build step at runtime.

Relative imports inside the packages carry explicit `.js` extensions, which is
mandatory for Node ESM and for the Vite/Vitest toolchain, but looks redundant
to a CommonJS-only reader.

## Decision

`packages/shared-types` and `packages/utilities` publish a dual build from a
single source tree:

- `tsconfig.types.json` emits declarations to `dist/types`.
- `tsconfig.cjs.json` emits CommonJS to `dist/cjs` and writes a
  `dist/cjs/package.json` containing `"type": "commonjs"`.
- `tsconfig.esm.json` emits ES modules to `dist/esm` and writes a
  `dist/esm/package.json` containing `"type": "module"`.

The root `exports` map declares `types`, `import`, and `require` conditions, so
Node and bundlers each pick the artifact they need. `scripts/write-dist-markers.mjs`
generates the two marker `package.json` files after each build so the build stays
a single command.

Every relative import inside these packages uses an explicit `.js` extension,
matching the extension of the emitted artifact.

## Consequences

One source tree serves three resolvers, so domain types cannot drift between
the backend and the PWAs. Consumers get working tree-shaking and accurate
`import type` resolution in both module systems. The cost is three compiler
passes per package and a `dist/` layout that is not directly readable. Because
`dist/cjs` and `dist/esm` are separate, a `.d.ts` file must sit in one location
only; mixing it with the CJS output produces duplicate-identifier errors that
only appear in `require` consumers.

## Alternatives considered

- **ESM only, with a transpiling dev dependency.** Would force the CommonJS
  backend to either become ESM or carry `ts-node`/`tsx` in production.
- **Bundled single-file output per package.** Rejected: it hides the real file
  structure from stack traces and complicates source-map chains across the four
  applications.
- **Type-only packages with duplicated runtime logic.** Rejected outright: the
  money helpers and state machines are runtime logic, and duplicating them is
  exactly the drift this package exists to prevent.
