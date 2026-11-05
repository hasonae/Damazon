# ADR-0003: Represent money as integer minor units

- Status: Accepted
- Date: 2026-10-05

## Context

Damazon operates in Syria, where the Syrian pound has no circulating minor unit
in practice, while orders may also be priced in EUR, TRY, AED, SAR, or JOD.
Totals are computed from line items, delivery fees, discounts, and promotions,
and they must be compared for equality in idempotency checks and payment
verification. Floating point arithmetic cannot represent values such as
`0.1 + 0.2` exactly, so a float column would eventually produce a total that
does not match the sum of its parts.

## Decision

All monetary columns and transport fields are integer minor units, stored as
`BigInt` in PostgreSQL and `Prisma.BigInt`, and carried across the API as a
decimal string. A single currency registry in `@damazon/shared-types` defines,
per currency, the ISO code, the number of minor-unit digits, and its enabled
flag. `SYP` is the only enabled currency; `EUR`, `TRY`, `AED`, `SAR`, and `JOD`
are declared but disabled.

Formatting and parsing live in one place: `formatMinorUnits` renders a
BigInt-plus-currency pair for display, and `parseToMinorUnits` converts a
decimal string input into integer minor units. Presentation code may not
perform its own arithmetic or rounding.

The customer interface renders money with Latin digits even though the
interface is Arabic-first RTL, matching the requirement that monetary values
stay unambiguous in both directions.

## Consequences

Totals are exact and order-independent comparison is safe, so idempotency keys
and payment verification tolerances can compare integers directly. BigInt
arithmetic must be explicit: mixing a `BigInt` with a `number` throws at
runtime, so every calculation site uses BigInt literals and the money helpers.
The API contract exposes amounts as strings, which means clients cannot do
arithmetic on them by accident, but also means they must call the shared
helpers rather than treat the string as a number. Enabling an additional
currency later is a registry change plus a rounding review, because a
zero-decimal currency such as JOD collapses its minor-unit digits to 0.

## Alternatives considered

- **Decimal column with fixed scale.** Sound, but couples storage scale to the
  currency set and complicates currency switching; integers with a per-currency
  digit count generalise more cleanly across the registry.
- **Floating point with epsilon comparison.** Rejected: the epsilon that is
  safe for one total is not safe for summing thousands of orders in analytics,
  and it hides real reconciliation errors.
- **Minor units as `number`.** Rejected: exceeds `Number.MAX_SAFE_INTEGER` for
  large SYP totals, which is a realistic order-value range here.
