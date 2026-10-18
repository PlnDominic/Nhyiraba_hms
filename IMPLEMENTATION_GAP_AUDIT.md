# Nhyiraba HMS: 50 Implementation Gaps

This is a static codebase audit of `client/` and the Express/Supabase integration. The items below are candidate gaps or incomplete production capabilities to validate against the product requirements and deployed database. They are ordered broadly by impact, not by implementation sequence.

## Core hotel operations

1. **Reservation availability validation** — Prevent overlapping reservations for the same room before creation, including race-safe server/database enforcement.
2. **Reservation modification workflow** — Add a complete edit flow for dates, room, guest, rate, payment status, and notes with conflict revalidation.
3. **Reservation cancellation policy** — Support cancellation reasons, cutoff rules, fees, refunds, and an auditable cancellation status.
4. **Waitlist management** — Let staff add guests to a waitlist, prioritize them, and convert entries into reservations when rooms become available.
5. **Room assignment and reassignment** — Provide a dedicated workflow for assigning rooms, moving guests, and recording who made the change.
6. **Room housekeeping lifecycle** — Implement clean/dirty/inspected/out-of-service states with housekeeping actions and timestamps.
7. **Check-in validation** — Require identity/contact details, deposit/payment confirmation, room readiness, and signed policy acknowledgement before check-in.
8. **Check-out settlement** — Calculate the final folio, outstanding balance, deposits, late checkout, minibar/services, and receipt before checkout.
9. **Walk-in guest flow** — Add a quick walk-in reservation and check-in flow for guests without an existing booking.
10. **No-show processing** — Add automatic or manual no-show marking, notifications, charges, and room release rules.
11. **Group reservations** — Support multiple rooms/guests under one booking with shared billing and group-level status.
12. **Rate-plan management** — Add configurable seasonal, weekend, corporate, package, and promotional rates instead of hard-coded pricing paths.
13. **Taxes and service charges** — Make tax/service-charge rules configurable by property, item, and date, with transparent invoice breakdowns.
14. **Multi-property support** — Add a property/branch model and scope users, rooms, reports, and settings to a selected property.
15. **Room maintenance tickets** — Create, assign, prioritize, track, and close maintenance issues linked to rooms and assets.

## Guest and staff experience

16. **Guest profiles and history** — Consolidate stays, preferences, documents, payments, notes, and communication history in one guest profile.
17. **Duplicate guest detection** — Detect likely duplicate guests by email, phone, and identity details before creating a new record.
18. **Guest self-service portal** — Let guests view bookings, complete pre-check-in, request services, and download invoices securely.
19. **Guest communication center** — Add templated email/SMS/WhatsApp messages for confirmations, reminders, check-in, checkout, and service updates.
20. **Message delivery tracking** — Store delivery status, failures, retries, templates, and provider responses for outbound communications.
21. **Staff onboarding workflow** — Add invitations, email verification, first-login setup, password policy, and onboarding checklist completion.
22. **Staff availability and leave** — Track shifts, leave, overtime, availability, and staffing coverage by department.
23. **Role/permission administration** — Replace scattered role checks with a centralized permission matrix, effective dates, and permission audit history.
24. **Approval workflow engine** — Generalize approvals for access requests, discounts, refunds, purchases, schedule changes, and overrides.
25. **Staff performance review** — Add configurable goals, review periods, manager feedback, and performance history.
26. **Training and certification tracking** — Track required training, certificates, expiry dates, reminders, and completion evidence.
27. **Notification preferences** — Let users choose channels, quiet hours, event types, and department-specific notification subscriptions.
28. **In-app notification inbox** — Provide read/unread state, filtering, deep links, bulk mark-as-read, and retention rules.
29. **Profile and account security** — Add profile editing, avatar upload, password change, MFA/2FA, active-session management, and account deactivation.
30. **Localization and accessibility** — Add timezone, currency, date/number formats, keyboard navigation, screen-reader labels, and WCAG checks.

## Finance, inventory, and reporting

31. **Payment gateway integration** — Add secure card/mobile-money payment initiation, webhooks, reconciliation, and failed-payment handling.
32. **Refunds and credit notes** — Support partial/full refunds, credit notes, reason codes, approvals, and payment-provider reconciliation.
33. **Cash-drawer management** — Track opening float, cash movements, shift close, variance, and supervisor sign-off.
34. **Accounts receivable** — Add company/guest balances, invoices due, aging buckets, reminders, and payment allocation.
35. **Expense management** — Record expenses, receipts, categories, vendors, approvals, and accounting exports.
36. **Inventory stock controls** — Add stock counts, reorder points, batches/expiry, wastage, adjustments, and stock valuation.
37. **Purchase orders and receiving** — Create POs, approve them, receive partial deliveries, match invoices, and update inventory.
38. **Inventory transfers** — Support transfers between stores/departments with sender, receiver, quantity, and discrepancy tracking.
39. **Restaurant/bar POS completion** — Add table orders, modifiers, kitchen tickets, split bills, voids, discounts, and inventory deduction end-to-end.
40. **Management reporting suite** — Add occupancy, ADR, RevPAR, revenue, channel, cancellation, labor, inventory, and profitability dashboards.
41. **Report scheduling** — Let managers schedule recurring reports by email with saved filters and export format choices.
42. **Audit log and data export** — Record sensitive create/update/delete actions and provide authorized CSV/JSON exports with retention controls.
43. **PDF/receipt consistency** — Standardize invoice, receipt, report, and folio templates with property branding, tax IDs, and print layouts.

## Reliability, security, and deployment

44. **Server-side authorization** — Enforce roles and permissions on every privileged API/database operation; do not rely only on client route guards.
45. **RLS policy test suite** — Add automated tests for each table and role, including denial cases and cross-tenant access attempts.
46. **Input validation and normalization** — Add shared schemas for client/server payloads, strict types, length limits, date validation, and safe error messages.
47. **Centralized error handling** — Replace ad hoc alerts/logs with consistent API errors, user-friendly states, correlation IDs, and structured server logging.
48. **Offline sync conflict resolution** — Define a queue, retry/backoff, conflict policy, idempotency keys, and visible sync status for offline mutations.
49. **Automated testing coverage** — Add unit, integration, RLS, API, and end-to-end tests for authentication, reservations, check-in/out, billing, and mobile navigation.
50. **Production observability and operations** — Add health/readiness endpoints, uptime monitoring, error tracking, metrics, backups/restore drills, migration management, CI/CD, and environment validation.

## Notes from the audit

- The repository contains both a legacy `src/` tree and the active `client/src/` tree. The production client build uses `client/src/`; feature work should target that tree unless the duplicate is intentionally maintained.
- The client production build completes successfully, but it reports a substantial number of ESLint warnings, including unused state, missing React hook dependencies, and unsafe/noisy logging.
- Several debug/setup/test routes and scripts are present in the client. These should be disabled or protected in production.
- The list is intentionally broader than simple TODO markers: several items may exist partially, but still need a complete production workflow, authorization, validation, tests, and operational handling.
