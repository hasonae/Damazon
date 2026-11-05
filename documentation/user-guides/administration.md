# User Guide: Platform Staff

The administrative console is a separate application from the customer
application. It opens at its own address and shares no code with the consumer
interface beyond the design system's neutral primitives.

## Access

Staff sign in with an email address and password at the admin console address.
Your account needs an administrative department before any administrative
screens become usable.

## Departments and Permissions

Authority comes from your department membership, not from a job title. Joining a
department grants that department's permissions; leaving it removes them at once,
without waiting for any session to expire.

| Department | Typical scope                                            |
| ---------- | -------------------------------------------------------- |
| Orders     | Order review, disputes, forced transitions               |
| Finance    | Payouts, refunds, invoice review, payment reconciliation |
| Catalog    | Category and product moderation, business listings       |
| Support    | Customer tickets and conversations                       |
| Moderation | Reviews, reported content, coupons                       |
| Partners   | Business onboarding, document approval, subscriptions    |
| Marketing  | Promotions, banners, announcements                       |
| System     | Staff accounts, settings, audit log                      |

A super administrator department holds the full permission set. An account with
no department membership has no administrative access at all.

## Daily Work

**Orders.** Search and filter by status, business, city, zone, or customer. Read
the status history to see who made each change and why. A forced transition is
recorded with your name against the order.

**Finance.** Review pending payouts, approve or hold them, and open refunds with
a mandatory reason. The payment log shows every state change and gateway
callback, which is the first place to look when a total does not reconcile.

**Partners.** Review submitted business documents, approve or reject with a
reason, and manage subscription plans and invoices.

**Support.** Work the ticket queue, reply inside the ticket thread, and change
ticket status and priority.

**Moderation.** Review flagged reviews and reported content, hide or restore it.

**Analytics.** Order volume, revenue, delivery performance, and category
performance, filterable by date range and city.

**Audit log.** Every administrative action is recorded with the actor, the
action, the target, and what changed. Reading customer data is logged as well as
changing it.

## Conventions in the Console

- Amounts are exact integer minor units rendered with Latin digits.
- Timestamps are shown in the console's configured timezone and always carry the
  zone.
- Destructive or financial actions require confirmation and a reason, and the
  reason is written to the audit log.
- The console has no animations and is optimized for long sessions and keyboard
  navigation.

## Reporting a Problem

If the console behaves incorrectly, note the screen, the record involved, and
what you expected. Do not work around a permission failure by asking for a
broader department than the task requires.
