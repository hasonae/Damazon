# ADR-0004: Hash passwords with Node built-in scrypt

- Status: Accepted
- Date: 2026-10-05

## Context

Damazon holds customer, merchant, restaurant, delivery-company, driver, and
administrator credentials in one table. A compromise of the credential table is
a compromise of every account type at once, so the password hash is the single
most security-critical value in the system. The requirement specifies the
built-in `scrypt` primitive with `N=2^16`, `r=8`, `p=1`, and a
`scrypt$N$r$p$salt$hash` encoding that carries the parameters inside the stored
string.

Parameter changes must be possible without a flag day: the cost parameters are
embedded in each stored hash, so a rehash on next successful login is enough.

## Decision

`PasswordService` in `apps/backend/src/security/password.service.ts` uses
`node:crypto`'s `scrypt` with `N=2^16`, `r=8`, `p=1` and a 16-byte random salt
per password. Passwords are normalized to NFKC before hashing so that visually
identical input from an Arabic or mixed-script keyboard produces the same hash.
Hashes are encoded as `scrypt$N$r$p$saltB64$hashB64`, and verification parses
the parameters out of the stored string instead of reading configuration, which
makes a future cost increase a transparent migration.

Passwords are compared with `timingSafeEqual` over equal-length buffers, so
verification does not leak information through response timing. A password older
than `PASSWORD_MAX_AGE_DAYS` (default 180) is flagged at login for forced
rotation.

## Consequences

No native dependency has to be compiled or audited, and the algorithm is
memory-hard, which is the right property against GPU cracking. scrypt at these
parameters costs roughly 64 MiB and 50-150 ms per verification, so login is
CPU-bound: the login endpoint carries a tighter rate limit than the rest of the
API, and the cost is exposed in configuration so it can be lowered in local
development and raised in production. The embedded-parameter format means
`PasswordService` is the only component allowed to produce or compare these
strings; raw scrypt calls elsewhere are forbidden.

## Alternatives considered

- **bcrypt.** Extremely common and well understood, but not memory-hard, and it
  silently truncates input beyond 72 bytes, which is a correctness hazard for
  long passphrases.
- **argon2id.** The strongest modern choice, but it requires a native addon,
  which conflicts with the "no native toolchain" constraint implied by the npm
  workspace setup and complicates Windows and Alpine builds.
- **PBKDF2-HMAC-SHA512.** Available in Node with no dependency, but
  deliberately weaker against GPU attack, so it is not appropriate for
  platform-wide credentials.
