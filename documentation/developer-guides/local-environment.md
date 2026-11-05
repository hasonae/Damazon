# Developer Guide: Local Environment

## Prerequisites

| Tool       | Version | Check            |
| ---------- | ------- | ---------------- |
| Node       | 22.11.0 | `node --version` |
| npm        | 10.9+   | `npm --version`  |
| PostgreSQL | 16      | `psql --version` |

Use the pinned Node version:

```bash
nvm install     # reads .nvmrc
nvm use
```

Provide a reachable PostgreSQL instance and configure `DATABASE_URL` in the
root `.env`. This guide does not require Docker. The API currently does not use
Redis for request processing; the GitHub Actions workflow uses an ephemeral
Redis service only for its connectivity smoke check.

## One-Time Setup

```powershell
npm install
Copy-Item .env.example .env
npm run db:deploy
npm run db:seed
```

`.env` is generated from `.env.example` and is not committed. For local work the
template values are development placeholders. Configure a database URL and
replace all placeholder credentials before connecting to external services.
Never seed production data.

## Starting Services

```bash
npm run dev            # backend API on :3000
npm run dev:customer   # customer/business/driver PWA on :5173
npm run dev:admin      # admin PWA on :5174
```

`npm run dev` in the backend compiles with `tsc --watch` and restarts the process
through nodemon, so a save in `apps/backend/src` rebuilds and reloads.

## Verifying a Change

```bash
npm run verify   # format:check, lint, typecheck, build, test
```

Narrower loops while working:

```bash
npm run typecheck -w @damazon/backend
npm test -w @damazon/shared-types
npm run lint --workspaces
```

## GitHub Actions Runtime Checks

The `CI` workflow runs on pushes, pull requests, and manual dispatch. It uses
ephemeral PostgreSQL 16 and Redis 7 services, applies the committed database
migrations, runs `npm run verify`, then starts the built API and checks readiness
and the public catalog endpoints against the migrated database. Payment
configuration in CI uses dummy values and does not contact external providers;
the workflow is not a substitute for verifying payment or SMTP delivery with
the production mail provider.

## Database Workflow

```bash
npm run db:generate   # after editing prisma/schema.prisma
npm run db:migrate    # create + apply a development migration
npm run db:status     # what is applied
npm run db:reset      # drop, re-migrate, re-seed (destroys local data)
```

Migration SQL is committed and reviewed. `db push` is not used.

To inspect data, either `npm run db:studio -w @damazon/backend` or connect with
any PostgreSQL client using the credentials in `.env`.

## Troubleshooting

**`P1012: Environment variable not found: DATABASE_URL`** — run from the
repository root, or ensure `.env` exists. `prisma.config.ts` resolves the root
`.env` and then `apps/backend/.env`.

**Port 3000 already in use** — change `PORT` in `.env`.

**Cannot connect to PostgreSQL** — verify the host, port, database name, TLS
requirements, and credentials in `DATABASE_URL`; then check connectivity using
your PostgreSQL provider's console or a local `psql` client.

**Stale generated client** — `npm run db:generate`.

**Wrong decorators at runtime** — the backend must be started through its npm
script so `tsc` emits `emitDecoratorMetadata`. Running the TypeScript sources
directly with a transpile-only loader drops the metadata NestJS dependency
injection relies on.
