# BizFlow AI — Pivot Plan

## The pivot in one line

From a **multi-tenant self-service SaaS** to a **reusable, single-tenant WhatsApp AI automation framework** that the developer configures and deploys once per client.

- One deployment = one business.
- No public signup, no subscriptions, no tenant switching.
- Each client gets a tailored automation built from the same framework by changing **configuration and seed data**, not code.

Target shapes:
- **Pizza shop** — WhatsApp ordering + business approval.
- **Phone store** — inventory questions + repair booking + lead capture.
- **Clinic** — appointment booking + FAQ.
- **Garage** — service booking + quote request.

All four are the same engine with different config: which flows are on, the catalog/services, the AI persona and knowledge, business hours.

---

## 1. What changes from the current plan

| Area | Before (SaaS plan) | After (framework) |
|---|---|---|
| Tenancy | Multi-tenant, many businesses per DB | **Single-tenant per deployment.** One business per instance. |
| Isolation | Postgres RLS + `withTenant()` + separate app/admin roles | **Dropped.** The deployment is the boundary. One DB role. |
| Onboarding | Public signup creates a Business + owner | **Developer seed script** creates the one business + staff. No signup. |
| Auth | Auth.js credentials for public users | **Staff-only login** for the approval panel. A handful of seeded accounts, no self-registration. |
| Main UI | Multi-tenant dashboard as the product | **Internal approval panel** for the business (approve orders, watch conversations, take over). |
| Config | Module toggles tied to a billing plan | **Per-client config file + seed data** decide which flows are active. |
| Primary channel | Chat Simulator now, WhatsApp "V2" | **WhatsApp Cloud API is the product.** Simulator stays as the dev/test channel. |
| Billing/subscriptions | Critical (C3) | **Removed.** Not part of the framework. |

Net effect: a large amount of the "hard" MVP work (RLS, tenant plumbing, admin/app split, module gating, billing) **goes away**. The remaining effort concentrates on the parts that actually differentiate a client automation: the AI engine, the flows, WhatsApp I/O, and the approval panel.

What stays true from `docs/MASTER_PRD.md`: the AI is an operator not a chatbot; it executes via tools, never touches the DB directly; every flow produces structured data; low-confidence/complaint → human handover. The AI tool-authorization discipline (old C5) still applies — customer messages are untrusted, tools validate and are the only path to state.

---

## 2. What existing code can be kept

Phase 1 already scaffolded a working Next.js + Drizzle + Postgres app. Most of it is reusable; the multi-tenant machinery is what gets stripped.

**Keep as-is:**
- Next.js + TypeScript + Tailwind scaffold — `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `globals.css`.
- Postgres + Drizzle setup — `docker-compose.yml`, `drizzle.config.ts`, `scripts/migrate.ts`, `scripts/env.ts`.
- `src/db/schema.ts` — the `businesses` and `accounts` tables survive with a changed meaning (see below).
- Password hashing — `src/lib/password.ts`.
- Auth.js login path — `src/lib/auth.ts`, the route handler, and `src/app/(auth)/login/page.tsx`. Login stays for staff.
- The authenticated shell — `src/app/(app)/layout.tsx` and `dashboard/page.tsx` become the approval-panel shell.

**Keep, but repurpose:**
- `businesses` table → holds **the one** business's config row (name, currency, timezone, hours, persona settings). Effectively a singleton.
- `accounts` table → **staff** who log into the approval panel. Seeded by the developer, no signup.
- `withTenant()` / the RLS idea → not needed for isolation anymore, but the transaction wrapper is still a fine place to hang per-request DB concerns. Simplify it or drop it (see §3).

**Keep as planned (not yet built):** the AI engine (`src/ai/*`), chat simulator, order/appointment/lead flows, audit log, money helpers. These are now the *center* of the work, not the tail end.

---

## 3. What should be removed or ignored

Nothing needs deleting today (no code changes this step), but the following is now dead weight and should be removed when Phase 2 starts:

- **Public signup** — `src/app/(auth)/signup/page.tsx` and the `signup` action in `src/app/(auth)/actions.ts`. Replace with a `scripts/seed.ts` the developer runs per deployment.
- **Multi-tenant RLS** — the RLS role, policies, and `bizflow_app`/admin split in `drizzle/0000_init.sql`; `src/db/admin.ts`; the tenant filtering in `src/db/tenant.ts`. One business per DB means no cross-tenant risk to guard. Collapse to a **single DB connection** in `src/db/client.ts`.
- **`business_id` everywhere** — optional. Either drop it (single business) or keep a constant `BUSINESS_ID` for tidy foreign keys and a possible future where one host serves several clients. Recommendation: **keep the column, drop the RLS** — cheap insurance, zero runtime cost.
- **Module-gating / billing** — the `Business Module` and any subscription concepts. Flows are toggled by config, not a plan.
- **The RLS verification script** — `scripts/check-rls.ts`. No RLS to verify. Remove.

`ponytail:` if you ever co-host multiple clients in one database, RLS comes back. Until then it is complexity with no tenant to protect.

---

## 4. New MVP architecture

One deployment serves one business. Configuration + seed data specialize it.

```
Client (WhatsApp) ─┐
                   ├─► Channel adapter ─► AI Engine ─► Tools ─► Postgres
Developer (Sim) ───┘        (WhatsApp | Simulator)      │
                                                        └─► Approval Panel (staff UI)
```

**Components**

1. **Business config (per client).**
   - A typed config, e.g. `src/config/business.ts` (or a row in `businesses` seeded from it): business identity, currency, timezone, hours, AI persona/system prompt, and **which flows are enabled** (`order`, `appointment`, `lead`, `faq`, `quote`).
   - Secrets (WhatsApp token, phone number id, verify token, DB URL, AI key) in `.env`.
   - Catalog/services, AI knowledge, and hours live in the DB, populated by `scripts/seed.ts` per client.

2. **Channel adapters (one interface, two implementations).**
   - `WhatsApp` — Cloud API webhook (`POST /api/whatsapp` receive + GET verify) and a send function. Verify webhook signature.
   - `Simulator` — the existing chat-simulator page hitting `POST /api/chat`. Same message-in/message-out contract, so the engine is channel-agnostic and testable without WhatsApp.

3. **AI engine.**
   - The tool-use loop (Anthropic SDK, `claude-sonnet-5` default). Persona/system prompt from config.
   - **Enabled tools are derived from the config's enabled flows** — a pizza shop loads `search_products`/`create_order`; a clinic loads `book_appointment`/`search_knowledge`. Same engine, different tool set.
   - Tools validate input (Zod), are the only path to the DB, and write an audit entry. Handover tool stops the AI and flags the conversation for staff.

4. **Flows (config-toggled).**
   - **Order** — search catalog → build order → confirm → create Order (pending) → notify staff → staff approves/rejects → customer told.
   - **Appointment** — check hours/availability → offer slots → book → confirm.
   - **Lead** — capture contact + interest when no purchase → staff follow-up list.
   - **Quote** — capture request details → staff responds with a quote.
   - **FAQ** — `search_knowledge` over seeded content.
   - **Handover** — complaint / low confidence / explicit request → assign to staff, AI silent until handed back.

5. **Approval panel (staff UI).**
   - Reuses the authenticated shell. Staff-only login.
   - Pages: **pending orders** (approve/reject), **conversations** (watch live, take over / hand back), **leads/quotes** to follow up, and a simple **catalog/knowledge** editor so the developer/owner can tune content.

**Data model** — mostly as in `docs/MASTER_PRD.md` (Customer, Product/Variant/Extra, Order/OrderItem, Appointment, Conversation, Message, Lead, AI Knowledge, Business Hours, Audit Log), minus the multi-tenant scaffolding. `Account` = staff. No Subscription/Module/Notification-recipient tenancy concerns.

---

## 5. First development steps

Goal of the first pass: **prove the config-driven engine end to end on the Simulator, for one example business (pizza shop), with a working approval step** — before wiring real WhatsApp.

1. **Strip SaaS scaffolding.**
   - Remove signup page + action; remove `check-rls.ts`.
   - Collapse `db/admin.ts` + `db/client.ts` into one connection; drop RLS from `drizzle/0000_init.sql`; simplify or remove `db/tenant.ts`.
   - Add `scripts/seed.ts` that creates the single business + one staff login from config.

2. **Define the business config contract.**
   - `src/config/business.ts` type: identity, hours, persona/system prompt, `enabledFlows`, and pointers to seed data (catalog, services, knowledge).
   - Ship one concrete example config: **pizza shop** (`order` + `handover` enabled).

3. **Channel abstraction + Simulator first.**
   - Define the message-in / message-out interface. Implement the Simulator adapter and `POST /api/chat`. (WhatsApp adapter comes after the engine works.)

4. **AI engine with config-driven tools.**
   - Tool loop; load the tool set from `enabledFlows`. Implement the pizza path first: `search_products`, `find_customer`/`create_customer`, `create_order` (pending), `handover`. Zod validation + audit on each.

5. **Approval panel minimum.**
   - Repurpose the shell into: pending-orders list with approve/reject, and a conversations view with take-over. Enough to close the pizza loop: customer orders in the Simulator → staff approves → customer sees confirmation.

6. **Then WhatsApp.**
   - Add the WhatsApp Cloud API adapter (webhook verify + receive + send, signature check) behind the same interface. No engine changes.
   - After that, add a second example config (e.g. clinic: `appointment` + `faq`) to prove the framework generalizes.

**Done when:** with the pizza config on the Simulator, a customer can place an order, staff can approve it in the panel, and the customer receives confirmation — all driven by config, no per-client code.

---

*No application code written. This is the pivot plan. `docs/MASTER_PRD.md`, `docs/BUILD_PLAN.md`, and existing Phase 1 code are unchanged — this document supersedes the SaaS-first framing in those where they conflict.*
