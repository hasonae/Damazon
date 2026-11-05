# Developer Guide: Adding a Feature

Damazon's constitution requires an explicit sequence for every feature. Skipping
steps is a review finding, not a style preference.

## The Sequence

1. **Identify dependencies.** Which packages, modules, and tables does this
   touch? If it needs a new shared contract, that contract lands in
   `@damazon/shared-types` first.
2. **Evaluate security implications.** Which role performs it? Which permissions
   are required? Is any data tenant-scoped? What is being written to the audit
   log?
3. **Evaluate performance implications.** Which queries run on the request path?
   What is the expected cardinality? Does anything need an index?
4. **Validate consistency with the design system.** For UI work: tokens and
   primitives only, no one-off values.
5. **Validate consistency with the data model.** Confirm the schema supports the
   required query, and that money, status, and identifiers use their established
   types.
6. **Write the implementation plan.** Module by module, file by file.
7. **Implement incrementally.** Schema and migration, shared contract, service,
   controller, then UI.
8. **Self-review.** Re-read the diff for the violations listed below.
9. **Refactor if required.**
10. **Generate tests.** Unit for domain logic, integration for repositories and
    services, e2e for the endpoint contract.
11. **Update documentation.** API conventions, data model, ADRs.
12. **Run the quality gates.** A feature is complete only when `npm run verify`
    passes.

## Architectural Violations to Check For

- A service writing an order status directly instead of calling
  `OrderStatusMachine.assertTransition`.
- A monetary `number` or float column or arithmetic outside the money helpers.
- A repository reading another module's tables.
- An endpoint that mutates state without a `@RequirePermissions` decorator.
- Tenant-scoped data queried without filtering on `activeBusinessId`.
- A domain rule validated in a controller or in the UI but not in the service.
- An administrative check based on the `admin` role rather than a department.
- A hardcoded value that belongs in a token or a system setting.
- A raw `console.log` outside a seed or test.

## Naming

- Modules: `apps/backend/src/modules/<domain>/`, with `*.controller.ts`,
  `*.service.ts`, `*.repository.ts`, `*.mapper.ts`, `*.module.ts`, and a
  `dto/` or `schemas/` folder for transport contracts.
- Shared contracts: named for what they are (`money.ts`, `order-status.ts`), not
  for the consumer.
- React components: `PascalCase.tsx`, one component per file, colocated styles.

## Definition of Done

A feature is done when:

- the migration is committed and reviewed;
- shared contracts are updated in both type and runtime form (Zod plus type);
- the controller declares validation and permissions;
- the service enforces domain rules and writes an audit entry where the data is
  sensitive;
- tests cover the rules, not just the happy path;
- documentation is updated;
- `npm run verify` passes.

## Related

- [Local environment](local-environment.md)
- [Architecture overview](../architecture/overview.md)
- [API conventions](../api/README.md)
