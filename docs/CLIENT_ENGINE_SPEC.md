# BizFlow AI — Client Automation Engine Spec

Defines the reusable framework the developer deploys, one instance per client. A new client automation is produced by writing a **config** and **seed data**, not by changing engine code.

Related: `docs/PIVOT_PLAN.md` (why), `docs/MASTER_PRD.md` (product intent), `docs/BUILD_PLAN.md` (original stack).

---

## 1. Model

- **One deployment = one business.** The deployment is the isolation boundary — no multi-tenancy, no RLS, no public signup.
- **Config-driven.** A `BusinessConfig` (see `src/config/types.ts`) specializes the engine: identity, hours, AI persona, which flows are enabled, catalog, knowledge, handover rules, and staff logins.
- **Same engine, different config.** Pizza shop, phone store, clinic, and garage are the same code with different configs and seed data.

```
Customer (WhatsApp) ─┐
                     ├─► Channel adapter ─► AI Engine ─► Tools ─► Postgres
Developer (Simulator)┘        (WhatsApp | Sim)    │
                                                  └─► Approval Panel (staff)
```

---

## 2. Configuration contract

Source of truth: `src/config/types.ts`. One config file per client; the active one is exported from `src/config/index.ts`.

Key fields:
- `name`, `businessType`, `currency` (ISO 4217), `timezone` (IANA), `locale`.
- `hours` — weekly open/close windows; drives the "closed" reply and appointment availability.
- `persona.systemPrompt` — how the AI speaks and what it may do.
- `enabledFlows` — the switch that decides which tools the AI loads (§4).
- `catalog` — categories + products with variants/extras. **Money is integer minor units** of `currency`.
- `knowledge` — FAQ entries for `search_knowledge`.
- `handover` — when to escalate to a human.
- `staff` — panel logins, seeded (passwords hashed at seed time).

Onboarding a client = copy `src/config/pizza.ts`, edit values, point `src/config/index.ts` at it, run seed.

---

## 3. Channel adapters

One interface, swappable implementations, so the engine is channel-agnostic and testable without WhatsApp.

```
interface ChannelAdapter {
  // inbound: normalize a provider payload into a canonical message
  parseInbound(payload): { from, text, mediaUrl?, channelMessageId }
  // outbound: send the AI's reply back to the customer
  send(to, message): Promise<void>
}
```

- **Simulator** (build first) — a panel page posting to `POST /api/chat`; renders the AI turn-by-turn including which tool it called. Primary dev/test channel.
- **WhatsApp Cloud API** (build after the engine works) — `GET /api/whatsapp` webhook verification, `POST /api/whatsapp` receive, and `send()` via the Graph API. Verify the webhook signature; store the phone number id + token in env.

Both feed the identical engine entry point.

---

## 4. Flows and tools

`enabledFlows` maps to a tool set. The AI never touches the DB directly; tools are the only path to state, each validates input (Zod), enforces its limits, and writes an audit entry.

| Flow | Tools (indicative) | Produces |
|---|---|---|
| `order` | `search_products`, `find_customer`, `create_customer`, `create_order` (status = pending) | Order awaiting approval |
| `appointment` | `check_availability`, `book_appointment` | Appointment |
| `lead` | `create_lead` | Lead for follow-up |
| `quote` | `create_quote_request` | Quote request |
| `faq` | `search_knowledge` | Answer from seeded knowledge |
| `handover` | `handover` | Conversation assigned to staff; AI goes silent |

Tool-authorization rules (carried over from the PRD): every tool scoped to this business; the AI may **create** orders but not **approve** them; no refunds/payments; ask for missing required fields; hand over on complaint / low confidence / explicit request per `handover` config.

---

## 5. AI engine (to build; not built yet)

- Anthropic tool-use loop, `claude-sonnet-5` default.
- System prompt from `persona.systemPrompt`; tool set assembled from `enabledFlows`.
- Per turn: receive canonical message → run loop (model may call tools) → persist messages → return reply to the channel adapter.
- Confidence/complaint detection triggers the `handover` tool, which flips the conversation to staff-owned and stops AI replies until handed back.

---

## 6. Approval panel (staff)

Reuses the authenticated shell (`src/app/(app)/`), staff-only login (no signup). Minimum pages:
- **Pending orders** — approve / reject; customer is notified on the result.
- **Conversations** — watch live, take over (handover) / hand back to AI.
- **Leads & quotes** — follow-up lists.
- **Catalog / knowledge** — light editing so content can be tuned without a redeploy.

---

## 7. Data model

As in `docs/MASTER_PRD.md` (Customer, Product/Variant/Extra, Order/OrderItem, Appointment, Conversation, Message, Lead, AI Knowledge, Business Hours, Audit Log), **minus** the multi-tenant scaffolding. `Account` = staff. `business_id` columns are retained for future flexibility but are not RLS-enforced. Currently only `businesses` + `accounts` exist; the rest are added per flow as those phases land.

---

## 8. Security

- Isolation is the deployment boundary; each client has its own DB and app instance.
- Customer messages are untrusted input — tool authorization and validation stand between the model and the database; message content is data, never instructions.
- WhatsApp webhook signature verified; provider tokens in env, not in the repo.
- Staff passwords hashed (argon2). No public registration.
- Money never floating point — integer minor units end to end.

---

## 9. Onboarding a new client (target workflow)

1. Copy `src/config/pizza.ts` → `src/config/<client>.ts`; edit identity, hours, persona, `enabledFlows`, catalog, knowledge, staff.
2. Point `src/config/index.ts` at the new config.
3. Provision a database + WhatsApp number; set env.
4. `npm run db:migrate && npm run db:seed`.
5. Test on the Simulator, then connect WhatsApp.

Deliverable per client: a config file + seed data + env — no engine code changes.

---

*No AI built yet. This spec defines the framework; Phase 2 stripped the SaaS scaffolding and added the config contract + pizza example that this document describes.*
