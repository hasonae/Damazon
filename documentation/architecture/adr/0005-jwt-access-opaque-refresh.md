# ADR-0005: Use JWT access tokens with opaque rotating refresh tokens

- Status: Accepted
- Date: 2026-10-05

## Context

Four separate PWAs share one API. Access must survive a page reload on flaky
mobile networks but must not remain valid for months, and a revoked session has
to take effect quickly. Password reuse and token theft are realistic threats for
a consumer marketplace, and an admin compromise must be containable without
waiting for an access token to expire.

A purely stateless JWT pair cannot be revoked before expiry, and a purely stateful
session cookie adds a database round trip to every request.

## Decision

The API issues a two-token pair per session.

The **access token** is a short-lived JWT (`JWT_ACCESS_TTL_SECONDS`, default 900
seconds) signed with `JWT_ACCESS_SECRET`. Its claims are `sub`, `sid`, `role`,
`bid`, and an explicit `typ: 'access'` discriminator. The `typ` claim is checked
on every verification, so a refresh token can never be replayed as an access
token even if it is presented to a protected endpoint.

The **refresh token** is also a JWT (so it carries its own expiry and needs no
lookup table) but is treated as opaque by clients and is recorded server-side
only as a SHA-256 hash, in the `scrypt`-free `sha256` column dedicated to token
digests. Refresh rotates: each call to `/auth/refresh` revokes the presented
token's row and issues a new `jti`. Presenting a token whose hash is not the
currently active token for that session is treated as replay and revokes the
whole session, which is the standard reuse-detection response.

The two signing secrets must differ, and production startup rejects the template
placeholder values. `/auth/logout` revokes the current session;
`/auth/logout-all` revokes every session for the user.

Access tokens are delivered in the JSON envelope; the refresh token is the only
candidate for an `HttpOnly`, `SameSite=Strict` cookie when a browser client is
used, and is never written to `localStorage`.

## Consequences

Every authenticated request validates a signature locally, so there is no
session lookup on the hot path. Revocation is bounded by the access-token TTL
for the access token itself, but session revocation via the refresh-token record
is immediate. Access tokens cannot be shrunk further than their TTL without
adding a lookup on every request, so the 15-minute default is a deliberate
tradeoff. Refresh-token theft is detected only if the attacker uses the stolen
token before the legitimate client refreshes, and reuse detection then logs the
legitimate client out; that is acceptable and is the intended failure mode.
Because `typ` is verified, any new token type added later must carry its own
discriminator.

## Alternatives considered

- **Fully stateful sessions in Redis.** Immediate revocation, but every request
  pays a network round trip to Redis, and Redis is then a hard dependency of
  authentication rather than a cache.
- **Long-lived JWTs with no refresh token.** Rejected: a leaked token stays
  usable for its full lifetime, which is unacceptable for administrator
  accounts.
- **Opaque access tokens.** Rejected: it removes the local signature check that
  makes the API's throughput independent of the database.
