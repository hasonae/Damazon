# ADR-0010: Validate every request and response with Zod

- Status: Accepted
- Date: 2026-10-05

## Context

The API is consumed by three PWAs that share its types but are built and
deployed separately. Contract drift between them is a runtime failure, not a
compile-time one: a client can send a stale field name or a string where an
integer is expected, and the result is a 500 with no useful message. Syrian
inputs add format-specific risk, since phone numbers arrive in several local
formats and free-text fields mix Arabic and Latin script.

## Decision

Zod schemas are the single definition of every transport contract, and they
live in `@damazon/shared-types` so the client and server validate against the
same object.

- `ZodValidationPipe` parses `body`, `query`, and `params` against the handler's
  declared schema before the handler runs. A failure produces a
  `VALIDATION_FAILED` response with a per-field `details` array; it never
  reaches the service layer.
- Response shapes are declared with Zod and validated by the response
  interceptor in development and test, so a handler that returns the wrong shape
  fails loudly instead of leaking an inconsistent payload to a PWA.
- Environment variables are validated by `environmentSchema` at startup. The
  process refuses to boot with an invalid or incomplete configuration, and
  refuses to boot in production while any JWT secret still holds its template
  value.
- Coercion happens in the schema, not in the handler: numeric query parameters
  and CSV lists are declared as coerced fields, so handlers receive typed values.

Client-side forms reuse the same schema objects through `@damazon/api-client`, so
a field constraint cannot be looser in the browser than on the server.

## Consequences

A malformed or hostile payload is rejected before any business logic or database
query runs, which keeps error responses uniform and makes field-level feedback
available to the Arabic-first forms. Contract changes break the typecheck in
every consumer at once. The cost is runtime cost: every request parses twice
(parse, then serialize), and response validation in development adds measurable
overhead, so it is disabled in production. Zod schemas are also more verbose
than TypeScript interfaces, and expressing some database-filter shapes as Zod is
awkward enough that ad-hoc validation tends to creep in; the rule is that
boundary schemas live with the transport contract, not inside services.

## Alternatives considered

- **`class-validator` with DTO classes.** The NestJS default, but it requires a
  decorator on every property and cannot be shared with the React PWAs without
  duplicating the definitions.
- **TypeScript types only, no runtime validation.** Rejected: types vanish at
  runtime, so the API would still trust whatever the network delivered.
- **JSON Schema plus a separate validator.** Rejected: it adds a second
  definition format and a code-generation step for no benefit over a single Zod
  object shared by both sides.
