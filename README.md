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

## GitHub Pages Demo Deployment

The Pages workflow publishes the customer PWA at
`https://<owner>.github.io/<repository>/` and the admin PWA under `/admin/`.
GitHub Pages serves static files only; it does not run the API, PostgreSQL, or
Redis. Set the repository Actions variable `DAMAZON_API_BASE_URL` to the public
HTTPS API URL ending in `/api/v1` before running the Pages workflow.

A no-cost demo can use a Render free web service for the API, an external
PostgreSQL database such as the existing Supabase project, Upstash Redis,
Cloudflare R2 for S3-compatible media, and an SMTP relay such as Resend. Supabase
Free includes 500 MB of database storage and pauses projects after a week of
inactivity. Cloudflare R2 includes 10 GB-month of standard storage, one million
Class A requests, and 10 million Class B requests per month at no charge.

The [Render Blueprint](./render.yaml) describes the API service. Render
explicitly advises against using free instances for production: the API sleeps
after 15 minutes without traffic, may take about a minute to wake, and has
monthly usage limits. Render free PostgreSQL expires after 30 days and its free
Key Value data is not persistent, so do not use those data services for real
customer data. Upstash's free Redis tier is limited to 250 MB, 10 GB monthly
bandwidth, and 500,000 commands. Resend's free email plan is limited to 100
messages per day and requires a verified sending domain. See the providers'
[Render free plan](https://render.com/docs/free),
[Supabase pricing](https://supabase.com/pricing),
[Upstash Redis pricing](https://upstash.com/pricing/redis),
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), and
[Resend pricing](https://resend.com/pricing).

This combination is appropriate only for a low-traffic demo. The free database
has no production backup guarantee, and services may pause or hit quotas.

For a Render API, configure `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=2587`,
`SMTP_SECURE=false`, `SMTP_USER=resend`, the Resend API key as `SMTP_PASSWORD`,
and a verified sender as `SMTP_FROM`. Render blocks outbound SMTP on ports 25,
465, and 587; Resend documents port 2587. Test actual delivery after deployment.
The Resend account must verify a sending domain before it can send to customers;
see its [SMTP setup](https://resend.com/docs/send-with-smtp).
Also configure production `DATABASE_URL`, `REDIS_URL`, distinct JWT secrets,
S3-compatible storage credentials, and:

- `CUSTOMER_APP_ORIGIN=https://<owner>.github.io/<repository>/`
- `ADMIN_APP_ORIGIN=https://<owner>.github.io/<repository>/admin/`
- `CORS_ALLOWED_ORIGINS=https://<owner>.github.io`

Free hosting is suitable for a demo, not a production launch with availability
or data-retention guarantees. Use paid, persistent services before accepting
real orders or customer data.

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
