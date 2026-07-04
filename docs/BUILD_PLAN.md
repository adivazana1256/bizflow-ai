# BizFlow AI — Build Plan

Practical, implementation-focused plan for the MVP defined in `docs/MASTER_PRD.md`. Covers only the MVP roadmap scope: Dashboard, Orders, Customers, Products, Chat Simulator, AI Knowledge, Basic Analytics, Business Settings.

Guiding principle: fewest moving parts that stay correct on the things the PRD refuses to compromise on — tenant isolation (C2), AI tool authorization (C5), and money handling (C6). Everything else stays boring on purpose.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| App | **Next.js (App Router), TypeScript** | Frontend + API in one codebase, one deploy. Fewest files for an MVP with a web UI and a small API. |
| DB | **PostgreSQL** | Required — the PRD mandates database-layer Row-Level Security (C2). Only Postgres gives us RLS cleanly. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | SQL-first, so setting the per-request tenant session variable RLS needs is straightforward and visible. |
| Auth | **Auth.js (credentials provider)** + argon2 password hashing | MVP is email + password. No third-party identity yet. |
| AI | **Anthropic SDK**, model `claude-sonnet-5` (default), tool-use loop | Sonnet 5 for the per-message agent loop (cost); escalate to `claude-opus-4-8` only for hard cases if needed. |
| Validation | **Zod** | One schema per tool input and per API body — reused by C5 tool-authorization checks. |
| Styling | **Tailwind CSS** | Default with `create-next-app`; no component-library lock-in for MVP. |

**Deliberately deferred (do not build for MVP):**
- Background job queue / scheduler → only needed for Reminders + Notifications, which are V2. `ponytail:` add when appointments/notifications land.
- WhatsApp / channel integrations → V2. MVP tests the AI via the **Chat Simulator** (a web page that talks to the same AI engine).
- Vector search → AI Knowledge uses Postgres full-text for MVP (H6).
- Billing/subscriptions → out of MVP scope (C3). Module gating only.

---

## 1. Recommended folder structure

```
bizflow-ai/
├─ docs/                        # existing specs
├─ drizzle/                     # generated SQL migrations
├─ src/
│  ├─ app/                      # Next.js App Router
│  │  ├─ (auth)/                # login, signup pages
│  │  ├─ (app)/                 # authenticated app shell
│  │  │  ├─ dashboard/
│  │  │  ├─ orders/
│  │  │  ├─ customers/
│  │  │  ├─ products/
│  │  │  ├─ knowledge/          # AI Knowledge
│  │  │  ├─ simulator/          # Chat Simulator
│  │  │  ├─ analytics/
│  │  │  └─ settings/
│  │  └─ api/
│  │     ├─ auth/               # Auth.js route
│  │     └─ chat/               # Chat Simulator → AI engine endpoint
│  ├─ db/
│  │  ├─ schema.ts              # Drizzle table definitions
│  │  ├─ client.ts              # pooled connection
│  │  └─ tenant.ts              # withTenant(): runs a query in a tx with app.business_id set
│  ├─ ai/
│  │  ├─ engine.ts              # the tool-use loop
│  │  ├─ tools/                 # one file per tool (create_order, search_products, ...)
│  │  └─ authz.ts               # per-tool authorization + limits (C5)
│  ├─ lib/
│  │  ├─ auth.ts                # Auth.js config
│  │  ├─ money.ts               # integer minor-units helpers (C6)
│  │  └─ audit.ts               # append-only audit log writer (H3)
│  └─ server/                   # server actions / service functions per module
├─ docker-compose.yml           # local Postgres
├─ drizzle.config.ts
└─ .env.local
```

Rule: **no query bypasses `src/db/tenant.ts`.** That wrapper is the single choke point that sets the RLS session variable. This is how C2 stays enforced instead of hoped-for.

---

## 2. Backend architecture

- **API surface:** Next.js server actions for CRUD (orders, customers, products, knowledge, settings); one route handler `POST /api/chat` for the Chat Simulator. No separate API server for MVP.
- **Tenant isolation (C2):** every request resolves `business_id` from the session, then runs all DB work through `withTenant(businessId, fn)`, which opens a transaction and issues `SET LOCAL app.business_id = $1` before any query. RLS policies on every tenant table filter on `current_setting('app.business_id')`. Nothing trusts application `where` clauses alone.
- **AI engine (C5):** `ai/engine.ts` runs the Anthropic tool-use loop. Each tool in `ai/tools/` (a) validates input with Zod, (b) passes through `ai/authz.ts` which enforces the hard limits — AI may create but not approve orders, no refunds/payments, no cross-customer writes — (c) runs inside the same `withTenant` scope, (d) writes an audit entry via `lib/audit.ts`. The model never gets a DB handle; it only names tools.
- **Money (C6):** all amounts are integers (minor units). `lib/money.ts` centralizes formatting/parsing so no float ever touches an amount. `payment_status` is a manual flag; no payment processing.
- **Roles/permissions (H5):** owner (Account) has all scopes; staff checks the Employee permission scopes before mutating.

---

## 3. Frontend architecture

- **Rendering:** React Server Components for read pages (dashboard, lists); client components only where interactive (chat simulator, forms).
- **App shell:** authenticated layout under `(app)/` with left-nav for the enabled modules — nav is driven by the `Business Module` table (H2), so disabled modules don't render.
- **Data:** server actions return typed data directly; mutations revalidate the affected route. No global client-state library for MVP.
- **Chat Simulator:** a client page that streams messages to `POST /api/chat` and renders the AI turn-by-turn, including which tool the AI called — this is how the AI engine is exercised before WhatsApp exists.
- **Forms/validation:** shared Zod schemas between client form and server action.

---

## 4. Database setup

- **Local Postgres** via `docker-compose.yml`.
- **Schema** in `src/db/schema.ts`, all tenant tables carry `business_id`. Use time-ordered UUIDs (UUIDv7/ULID) for high-write tables (Messages, Orders) per the PRD principle.
- **RLS:** enable RLS and add a policy on every tenant table:
  ```sql
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON orders
    USING (business_id = current_setting('app.business_id')::uuid);
  ```
  The `Audit Log` table is append-only (no UPDATE/DELETE grants). Soft delete on the rest.
- **Migrations:** `drizzle-kit generate` → review SQL → `drizzle-kit migrate`. RLS policies live in a hand-written migration alongside the generated schema.
- **Connection:** the app connects as a role that is subject to RLS (not the table owner / not superuser), otherwise policies are bypassed.

---

## 5. MVP build phases

Ordered so each phase is runnable before the next starts.

1. **Foundation.** Scaffold Next.js + Drizzle + Docker Postgres. Add `Business` and `Account` tables with RLS. Implement signup → create business → login → empty authenticated shell. *(This is the first task, detailed below.)*
2. **Settings + modules.** Business settings (currency, timezone, hours) and the `Business Module` toggle that drives the nav.
3. **Catalog.** Categories, Products, Variants, Extras — CRUD.
4. **Customers.** Customer CRUD + profile view.
5. **Orders.** Order + Order Item CRUD, status flow, money in minor units, manual `payment_status`.
6. **AI Knowledge.** Knowledge CRUD + Postgres full-text search.
7. **AI engine + Chat Simulator.** Tool loop with `search_products`, `find_customer`, `create_customer`, `create_order`, `search_knowledge`, `create_lead`, `handover`; authz + audit; simulator UI.
8. **Dashboard + Basic Analytics.** Read-only aggregates (revenue, orders, customers) computed from the above.

Appointments, Employees, Notifications, Reminders, WhatsApp — **not in these phases** (V2).

---

## 6. Exact first development task

**Goal:** a running app where an owner can sign up, a Business + owner Account are created, RLS is proven to isolate tenants, and the owner lands on an empty dashboard.

Steps:
1. `create-next-app` (TypeScript, App Router, Tailwind), add Drizzle, drizzle-kit, `postgres`, Auth.js, argon2, Zod.
2. `docker-compose.yml` with Postgres; `.env.local` with `DATABASE_URL` (using a non-owner app role) and `AUTH_SECRET`.
3. `src/db/schema.ts`: define `businesses` and `accounts` (fields per MASTER_PRD, including `businesses.currency`, `businesses.timezone`, `accounts.role`, `accounts.password_hash`). Generate migration.
4. Hand-written migration: enable RLS on `businesses` and `accounts` with policies keyed on `current_setting('app.business_id')`.
5. `src/db/tenant.ts`: `withTenant(businessId, fn)` — transaction + `SET LOCAL app.business_id`.
6. `src/lib/auth.ts`: Auth.js credentials provider; verify argon2 hash; session carries `accountId` + `businessId`.
7. Signup server action: create `Business` + owner `Account` in one transaction, hash password, sign in.
8. `(app)/dashboard/page.tsx`: empty authenticated page behind auth.
9. **Verification (the one check that matters):** seed two businesses; assert that a query run under business A's `withTenant` returns zero rows from business B. If RLS is right, this passes; if it's app-code-only, it fails. This guards C2 from day one.

Done when: signup → login → dashboard works, and the two-tenant isolation check passes.

---

## 7. Commands to run locally

```bash
# scaffold (first task)
pnpm create next-app@latest bizflow-ai --typescript --app --tailwind --eslint
cd bizflow-ai
pnpm add drizzle-orm postgres @auth/core next-auth zod @node-rs/argon2
pnpm add -D drizzle-kit @types/node

# start local Postgres
docker compose up -d

# migrations
pnpm drizzle-kit generate    # generate SQL from schema.ts
pnpm drizzle-kit migrate     # apply migrations (schema + RLS policies)

# dev server
pnpm dev                     # http://localhost:3000

# lint / typecheck
pnpm lint
pnpm tsc --noEmit

# run the tenant-isolation check (first-task verification)
pnpm test                    # or: pnpm tsx scripts/check-rls.ts
```

---

*Note: the changelog lives at `CHANGELOG.md` in the project root, not under `docs/`.*
*No application code written yet — this is the plan. Stopping here for review.*
