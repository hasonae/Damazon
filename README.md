# Damazon

Damazon is an enterprise marketplace platform for Syria. It connects customers
with merchants, restaurants, delivery companies, and drivers, and gives platform
staff a separate administrative console.

The repository is an npm-workspace monorepo (ADR-0001) containing two isolated
progressive web apps, a NestJS API, PostgreSQL persistence through Prisma, and
five shared packages.

## Requirements

- Node 22.12+ (latest Node 22 LTS; see `.nvmrc`)
- npm 10.9+
- A reachable PostgreSQL 16 database
- GitHub access for the hosted CI workflow
- Redis is required by production and staging APIs for shared request-rate limits

## Quick Start

The API connects to PostgreSQL through `DATABASE_URL`. Use your provisioned
PostgreSQL instance or a locally installed PostgreSQL server; this repository's
development setup does not require Docker.

```powershell
npm install
Copy-Item .env.example .env
npm run db:deploy
npm run db:seed
npm run dev
```

Before starting, set `DATABASE_URL` in `.env` to a database you control and
replace the template authentication and storage values. Email verification and
password recovery use short-lived, single-use links delivered by SMTP. Configure
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for a reachable
service; production and staging require these settings. `REDIS_URL` is also
required in those environments for shared rate limits. Authentication no
longer depends on Supabase.
If serving the API behind a reverse proxy, set `TRUST_PROXY_HOPS` to the known
number of trusted hops and prevent direct public access to the API.
Seed data is for development only and must never be loaded into a production
database.

The API then serves `http://localhost:3000/api/v1`. Verify with:

```powershell
curl http://localhost:3000/api/v1/health
```

The GitHub Actions `CI` workflow runs formatting, lint, type checks, builds, and
unit tests without Docker or external services. Apply database migrations
separately with `npm run db:deploy`.

## GitHub Pages Static Preview

The GitHub Pages workflow publishes static, clearly labelled preview pages at
`https://<owner>.github.io/<repository>/` and
`https://<owner>.github.io/<repository>/admin/`. This preview does not load or
bundle the application runtime. Sign-in, registration, API access, products,
orders, payments, advertisements, and administration are unavailable. Do not
enter credentials on the admin preview.

GitHub Pages hosts static files only. It cannot run the NestJS API, PostgreSQL,
Redis, email delivery, or media storage, and GitHub Actions is not a persistent
application server. A full, operational launch requires a backend and its
database and supporting services to be hosted somewhere that can run them.
Never put private credentials in GitHub Pages assets or a public repository.

## Repository Layout

```
apps/
  backend/          NestJS 11 API: auth, domain modules, Prisma
  customer-pwa/     Adaptive PWA: customer, merchant, restaurant, delivery, driver
  admin-pwa/        Isolated administrative console (ADR-0008)
packages/
  shared-types/     Roles, permissions, money, order state machine, API contracts
  utilities/        Result type, Syrian phone normalization, text and async helpers
  design-system/    Design tokens and UI primitives
  api-client/       Typed HTTP client built from the shared contracts
  configurations/   Shared build, lint, and toolchain presets
database/           Database assets and reference material
documentation/      Architecture, API, database, security, and guides
deployment/         Docker and infrastructure assets
tests/              Cross-workspace and end-to-end suites
```

## Development Seed Accounts

The non-production seed creates demo accounts with the password
`Damaz0n!Seed2026`. Never use these credentials in a public or production
environment.

| Role             | Identifier           |
| ---------------- | -------------------- |
| Customer         | `0941000001`         |
| Merchant         | `0941000002`         |
| Restaurant       | `0941000003`         |
| Delivery company | `0941000004`         |
| Driver           | `0941000005`         |
| Admin            | `admin@damazon.test` |

Phone numbers are accepted in any local or E.164 form, so `0941000001` and
`+963941000001` are the same account.

## Scripts

| Command                | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the backend in watch mode                  |
| `npm run dev:customer` | Start the customer/business/driver PWA           |
| `npm run dev:admin`    | Start the admin PWA                              |
| `npm run build`        | Build packages, then applications                |
| `npm run typecheck`    | Build shared packages, then typecheck workspaces |
| `npm run lint`         | Lint every workspace                             |
| `npm test`             | Run unit tests in every workspace                |
| `npm run verify`       | format:check, lint, typecheck, app build, test   |
| `npm run db:deploy`    | Apply committed migrations                       |
| `npm run db:seed`      | Load reference data and demo accounts            |
| `npm run db:reset`     | Drop, re-migrate, and re-seed (local only)       |
| `npm run clean`        | Remove build and coverage output                 |

## Conventions

- Money is integer minor units in `BigInt`, formatted only through
  `@damazon/shared-types` (ADR-0003).
- Order status changes only through the shared state machine, whose authority is
  the Part 11 business requirements lifecycle (ADR-0007).
- Administrative permissions resolve from `AdminProfile.department`; the `admin`
  role alone grants nothing (ADR-0006).
- Every request and response is validated with Zod at the boundary (ADR-0010).
- Damazon sessions use JWT access tokens with rotating opaque refresh tokens
  (ADR-0004, ADR-0005). Registration and password recovery use single-use
  email links; accounts sign in with their existing password after email verification.
- The UI is Arabic-first RTL; money renders with Latin digits.

## Documentation

| Area                   | Path                                     |
| ---------------------- | ---------------------------------------- |
| Architecture overview  | `documentation/architecture/overview.md` |
| Architecture decisions | `documentation/architecture/adr/`        |
| API conventions        | `documentation/api/README.md`            |
| Database               | `documentation/database/README.md`       |
| Security model         | `documentation/security/README.md`       |
| Developer guides       | `documentation/developer-guides/`        |
| User guides            | `documentation/user-guides/`             |
