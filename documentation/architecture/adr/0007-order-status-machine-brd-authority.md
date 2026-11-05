# ADR-0007: Treat the BRD order lifecycle as the status authority

- Status: Accepted
- Date: 2026-10-05

## Context

The specification contains two partially overlapping descriptions of order
status. The business requirements document (Part 11) defines an eleven-state
lifecycle including the per-state transitions and the actor permitted to perform
each transition. A later consolidated status list in the technical requirements
carries a shorter set and, in places, omits states that the business document
requires, such as the separated preparation states.

The state machine is the backbone of the platform: it drives the customer order
timeline, merchant and restaurant order queues, driver task availability,
payment capture and refund rules, and the analytics pipeline. A missing state
means a missing screen, a missing notification, and a missing financial rule.

## Decision

Where the two lists conflict, the **Part 11 business requirements lifecycle is
authoritative**. `@damazon/shared-types` implements that lifecycle as an explicit
state machine with:

- the full status union as a single exported constant,
- an adjacency map of legal transitions,
- a predicate per transition naming the actor role allowed to perform it
  (customer, merchant, restaurant, delivery company, driver, admin),
- guards that reject any transition not present in the adjacency map, including
  self-transitions.

`OrderStatusMachine.assertTransition(from, to, actorRole)` is the only supported
way to change an order status. No service may write a status directly. A
transition that the business document does not permit is a bug, not a
configuration choice, so the state machine is covered by unit tests that assert
both the permitted and the rejected edges.

## Consequences

Every consumer of order status reads one source of truth, so the customer
timeline, the driver task list, and the finance report cannot disagree. The
machine is strict by construction: an operation that is legitimate in a real
operation but missing from the BRD will be rejected until the BRD is amended and
the machine is extended, which surfaces gaps as failures rather than as silently
missing UI. Because transitions carry an actor role, the same machine expresses
merchant, restaurant, and driver permissions on an order without duplicating the
rules. Adding a status is a one-line change plus tests, but any stored order in
the old state needs a data migration.

## Alternatives considered

- **The shorter technical status list.** Rejected: it drops states the business
  requirements need, so implementing it would knowingly ship an incomplete
  lifecycle.
- **Free-form status strings validated only at the UI layer.** Rejected: the
  database would accept any value, and illegal transitions would be reachable by
  direct API calls.
- **A workflow engine (Temporal, XState) driving orders.** Strong modelling, but
  a large operational dependency for an eleven-state lifecycle that is fully
  expressible as a transition table, and it would move business rules out of the
  shared types package that all four applications already depend on.
