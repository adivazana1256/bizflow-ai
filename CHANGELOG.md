# Changelog

All notable changes to the BizFlow AI product specification.

## [Unreleased] — MASTER_PRD.md updates from REVIEW.md

Applied the approved **Critical** and **High** priority fixes from `docs/REVIEW.md` into `docs/MASTER_PRD.md`. Scope limited to resolving inconsistencies and MVP-required missing requirements. No V2/future features were added; existing document structure was preserved and unrelated sections were left unchanged.

### Critical

- **C1 — Authentication / identity model.** Added the `Account` entity (id, business_id, full_name, email, password_hash, role, active, created_at). Defined MVP auth as email + password, roles owner/staff, and the Account↔Employee relationship (an Employee may or may not link to an Account).
- **C2 — Tenant isolation mechanism.** Updated the "Multi Tenant" database principle to require database-layer enforcement (Row-Level Security keyed on `business_id`), stating that any query without a tenant predicate is a bug.
- **C3 — Module gating.** Added the `Business Module` entity to record which modules a business has enabled. Explicitly noted that subscription/billing entities (plans, invoices, payment collection) are out of scope for MVP and intentionally not modeled; module enablement is the only MVP gating mechanism.
- **C4 — Lead entity (inconsistency).** Added the `Lead` entity (id, business_id, customer_id, source, status, follow_up_at, notes, created_at) referenced by User Flow 6 and the AI `create_lead()` tool. Added Lead relationship.
- **C5 — AI tool authorization & prompt injection.** Added "Tool Authorization" and "Prompt Injection" subsections to AI Engine → Security: per-call tenant scoping, input validation, hard limits (AI may create but not approve orders, no refunds/payments, no cross-customer edits), idempotency on record creation, mandatory audit logging, and treating customer message content as data, never instructions.
- **C6 — Money type & currency (inconsistency).** Added required `currency` field to `Business`. Specified all monetary amounts are stored as integer minor units (never floating point) in the Order notes and the database principles. Clarified `payment_status` is manual (unpaid/paid) for MVP with no payment processing.

### High

- **H1 — Product Variants and Extras (inconsistency).** Added `Product Variant` and `Product Extra` entities. Added `variant_id` and `extras` to `Order Item`, and specified that `Order Item.price` is frozen at order time (base + deltas) so catalog changes do not alter historical orders.
- **H2 — Enabled-modules entity (inconsistency).** Resolved via the `Business Module` entity (see C3).
- **H3 — Audit log (inconsistency).** Added the append-only, immutable `Audit Log` entity (actor_type, actor_id, action, entity_type, entity_id, details, timestamp). Required every AI tool invocation to write an entry. Noted soft delete does not apply to it.
- **H4 — Business hours / availability (inconsistency).** Added `Business Hours` and `Employee Availability` entities, and noted appointment booking checks both. Added the `Appointment.status` enum.
- **H5 — Roles & permissions.** Defined roles on `Account` (owner, staff) and on `Employee` (manager, agent), added a `permissions` field and MVP permission scopes to `Employee`, and linked Employee to Account via `account_id`.
- **H6 — AI Knowledge retrieval.** Added a `source` field to `AI Knowledge` and specified MVP retrieval as full-text search over title/content (no vector infrastructure yet). Referenced the knowledge-ingestion path via the AI Knowledge module.
- **H7 — Onboarding flow.** Added "Flow 0 — Onboarding" to User Flows (sign up → create business → select type → enable modules → seed catalog/knowledge → ready).
- **H8 — Notification recipient (inconsistency).** Added `recipient_account_id` to `Notification` so notifications route to a person, with per-recipient `read` state.
- **H9 — Order vs. customer ordering (inconsistency).** Clarified in the `Order` notes that `customer_id` may be null on a draft order and is required on confirmation; added a customer identify/create step to User Flow 1 before order creation.
- **H10 — Async / reminders.** Added the `Reminder` entity (type, reference_id, run_at, status) and noted reminders and notifications are dispatched asynchronously by a background job/scheduler, never inline with requests.

### Cross-cutting

- **Enums.** Constrained `Message.sender` (customer/ai/employee/system), `Message.message_type` (text/image/file), and noted `Conversation.channel` and order/appointment statuses are enums, not free text.
- **Relationships.** Extended the Relationships section to cover Account, Lead, Product Variant/Extra, Business Hours, Employee Availability, Notification recipient, Business Module, Reminder, and Audit Log.
- **Database Principles.** Added indexing guidance for high-volume tables, time-ordered UUID (UUIDv7/ULID) guidance, and the money storage rule.

### Not applied (out of approved scope)

- Medium and Low priority items from `docs/REVIEW.md` were not applied.
- Subscription/billing/invoicing, payment processing, additional channels, and other V2/V3 roadmap items were intentionally excluded per the MVP-only constraint.

### Unchanged

- No application code written.
- `docs/REVIEW.md` unchanged. Executive Summary, Mission, Vision, Product Philosophy, Functional Requirements module list, and the Roadmap in `docs/MASTER_PRD.md` were left as originally provided.
