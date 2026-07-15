# BizFlow AI

🚀 AI Employee Platform for WhatsApp Businesses

BizFlow AI enables small businesses to deploy an AI Employee over WhatsApp capable of handling sales, customer support, lead generation and operational workflows.

Instead of building separate chatbots for every business, BizFlow AI provides one reusable execution platform where each business is represented through configuration.

---

## 🤔 Why BizFlow AI

Small businesses can't afford to staff WhatsApp 24/7 — every missed message is a missed sale, a missed booking, or a customer who goes elsewhere.

BizFlow AI provides an AI Employee capable of:

- 💬 Answering customers
- 🛒 Taking orders
- 🔧 Booking repairs
- 📇 Capturing leads
- 🙋 Escalating to humans
- 🧑‍💼 Supporting employees

The goal isn't to build a chatbot. It's to build an **AI Employee** — one that works the business's real workflows, not a scripted decision tree bolted onto WhatsApp.

## ✨ Feature Highlights

✅ WhatsApp Cloud API &nbsp;·&nbsp; ✅ Generic Execution Engine &nbsp;·&nbsp; ✅ Multi-Business Architecture &nbsp;·&nbsp; ✅ Approval Workflow &nbsp;·&nbsp; ✅ AI-ready Tool Registry &nbsp;·&nbsp; ✅ Simulator

## What it does

Customers message a business on WhatsApp. BizFlow AI understands the intent, runs a config-driven conversation flow (ordering, repair booking, lead capture, FAQ, human handover), persists the structured business data (orders, leads, bookings), and lets staff approve or reject it from an in-app Approval Panel. Approving or rejecting sends a WhatsApp reply straight back to the customer.

Each deployment serves **one business**. The core engine is business-agnostic — a business is expressed as configuration ("client config" layered on a "template"), not as bespoke code.

## Main features

- Config-driven, multi-flow conversation engine (ordering, repair booking, lead capture, FAQ, handover)
- WhatsApp Cloud API transport with signature verification and idempotent webhook handling
- Structured persistence of conversations, orders, leads, and repair bookings in PostgreSQL
- Staff Approval Panel — approve/reject with details (e.g. pick an ETA or repair mode) and auto-reply to the customer
- In-app Simulator to exercise the same engine and flows without a WhatsApp account
- Tool Registry — 7 typed, zod-validated business actions, scaffolded and ready for a future Claude tool-loop
- Two working example blueprints: a pizza shop and a phone repair store

## Real end-to-end flow

```mermaid
flowchart TD
    A[Customer] --> B[WhatsApp]
    B --> C[Meta Cloud API]
    C --> D["Transport Layer\n(signature verify + wamid idempotency)"]
    D --> E[Conversation Manager]
    E --> F["Execution Engine\n(deterministic, config-driven)"]
    F --> G[Tool Registry]
    G --> H["Business Actions\n(create_order / create_lead / book_repair)"]
    H --> I[(PostgreSQL)]
    I --> J["Approval Panel\n(staff approve/reject)"]
    J --> K[Customer Reply]
    K --> A

    L["🧠 AI Brain (Future)\nnot yet wired"] -.-> F
    L -.-> G

    style L stroke-dasharray: 5 5
```

1. A customer sends a WhatsApp message to the business number.
2. Meta's Cloud API delivers it to the app's webhook.
3. The Transport Layer verifies the Meta signature (HMAC-SHA256) and dedups retries by `wamid` before anything else runs.
4. The Conversation Manager persists the inbound message and loads conversation history.
5. The Execution Engine — deterministic, keyword/slot-filling logic driven by the business's config — decides the next step (ask a question, confirm an order, capture a lead, hand over to a human, etc).
6. The Tool Registry exists as the seam for this step but is not yet wired into the runtime — see [Vision & Roadmap](#-vision).
7. When a flow completes, a business action handler (`create_order`, `create_lead`, `book_repair`) persists structured data to PostgreSQL.
8. Staff review and approve/reject the record in the Approval Panel, optionally setting an ETA or repair mode.
9. The decision triggers a WhatsApp reply back to the customer.

The **AI Brain (Future)** node above is not implemented — it marks where a Claude-driven tool loop will eventually replace the deterministic decision logic in step 5 and start calling the Tool Registry directly.

## Architecture overview

- **Template + Client config, merged by a loader.** A *template* (`src/templates/*`) defines a business type (pizza shop, phone store) — its flows, menu/catalog shape, and copy. A *client* (`src/clients/*`) supplies the specific business's data (Tony's Pizza, Galaxy Mobile). `src/config/loader.ts` merges the two into the single `businessConfig` the rest of the app reads.
- **Business-agnostic core.** The Execution Engine, transport, persistence, and Approval Panel code contain no business-specific logic — everything specific lives in config.
- **Single-tenant per deployment.** One business per running instance; the deployment itself is the isolation boundary. There is no multi-tenant database, no row-level security, no tenant switching.
- **Transport abstraction.** WhatsApp Cloud API is behind a transport interface (`src/transport`) so the Simulator can exercise the same Conversation Manager and Execution Engine without touching WhatsApp.
- **Deterministic Execution Engine today.** `src/flow/engine.ts` runs keyword/slot-filling logic against the merged config — no LLM call is made in the current runtime.
- **Tool Registry (scaffolding).** `src/tools/*` defines 7 tools with metadata and zod input schemas, built as the seam for a future Claude-driven tool loop. It is not called by the Execution Engine yet.

See `docs/FRAMEWORK_ARCHITECTURE.md`, `docs/FLOW_ENGINE.md`, `docs/TRANSPORT_LAYER.md`, `docs/WHATSAPP_ARCHITECTURE.md`, `docs/BLUEPRINT_GUIDE.md`, and `docs/CLIENT_ENGINE_SPEC.md` for the full details.

## Supported business blueprints

| Blueprint | Example client | Flows |
|---|---|---|
| Pizza shop | Tony's Pizza | Menu ordering, order confirmation |
| Phone store | Galaxy Mobile | Repair booking, lead capture, product availability via knowledge search |

## Supported actions

| Tool | Description |
|---|---|
| `create_order` | Persist a pending order (items, options, total) for staff approval |
| `create_lead` | Capture a contact and their interest for staff follow-up |
| `book_repair` | Book a repair request awaiting staff confirmation |
| `handover_to_human` | Flag a conversation for a human staff member to take over |
| `search_products` | Look up product/catalog availability |
| `search_knowledge` | Search business FAQ/knowledge content |
| `get_customer_history` | Fetch a customer's past conversations/orders |

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- React 19, Tailwind CSS v4
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Auth.js](https://authjs.dev) (credentials provider, staff login)
- [zod](https://zod.dev) for schema validation
- WhatsApp Cloud API (Meta)
- Docker Compose for local PostgreSQL
- Node.js runtime

## Local installation

Prerequisites: Node.js, Docker (for local Postgres).

```bash
git clone <this-repo>
cd bizflow-ai
npm install
```

## Required environment variables

Copy `.env.example` to `.env.local` and fill in real values — never commit `.env.local`.

```bash
cp .env.example .env.local
```

| Variable | Placeholder | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/bizflow` | Matches the local Docker Postgres by default |
| `AUTH_SECRET` | `change-me-to-a-random-32-byte-secret` | Auth.js session secret |
| `AUTH_TRUST_HOST` | `true` | Required by Auth.js in dev |
| `WHATSAPP_VERIFY_TOKEN` | `your-webhook-verify-token` | Used by Meta to verify the webhook URL |
| `WHATSAPP_APP_SECRET` | `your-meta-app-secret` | Used to verify `X-Hub-Signature-256` on inbound webhooks |
| `WHATSAPP_ACCESS_TOKEN` | `your-permanent-access-token` | Meta Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | `your-phone-number-id` | Meta Cloud API phone number ID |
| `WHATSAPP_API_VERSION` | `v21.0` | Meta Graph API version |

WhatsApp credentials are optional for local development — the Simulator exercises the full engine without them.

## How to run

```bash
docker compose up -d      # start local Postgres
npm install
npm run db:migrate        # apply schema
npm run db:seed           # seed demo data (e.g. Tony's Pizza)
npm run dev                # http://localhost:3000
```

## Demo credentials

Development-only staff login (seeded, fictional, gated by `NODE_ENV !== "production"`):

```
email:    owner@tonys.local
password: changeme123
```

This is a development bypass and is disabled in production — do not rely on it for a real deployment.

## 🔭 Vision

BizFlow AI is not designed to be another chatbot.

Its vision is to become an **AI Employee platform** — capable of performing real business tasks over WhatsApp through structured, typed business tools, not free-text scripts. The Execution Engine and Tool Registry already exist as the scaffolding for that; the deterministic logic running today is the first, honest step toward it.

## 🗺️ Roadmap

**Completed**
- ✅ WhatsApp Cloud API
- ✅ Conversation Manager
- ✅ Execution Engine
- ✅ Tool Registry
- ✅ Approval Panel
- ✅ Multi-business architecture

**Next**
- ⬜ Claude Brain
- ⬜ Customer Memory
- ⬜ Business Memory
- ⬜ Payment Integrations
- ⬜ Appointment Scheduling
- ⬜ AI Employee Autonomy

The engine you can run today is deterministic — no LLM is in the runtime loop. Wiring a real Claude tool-loop into the Execution Engine, so the AI (not keyword matching) drives the conversation and calls the Tool Registry, is the next milestone.

**Fast-follows:**
- Per-conversation locking (concurrent webhook deliveries for the same conversation)
- Webhook failure alerting / outbox pattern for reliable delivery
- Authentication on `/api/chat` (currently used by the Simulator)

## Security notes

- Real secrets live only in `.env.local`, which is git-ignored and must never be committed.
- The WhatsApp webhook verifies Meta's `X-Hub-Signature-256` (HMAC-SHA256) on every inbound request and dedups retried deliveries by `wamid`.
- Each deployment serves one business; there is no shared multi-tenant database to isolate.
- Money is stored as integer minor units (e.g. cents) throughout — never as floats.
- The dev login bypass is gated by `NODE_ENV`; ensure `NODE_ENV=production` in any production deployment.

## Screenshots

![Simulator](docs/screenshots/simulator.png)
![Approval Panel](docs/screenshots/approval-panel.png)
![WhatsApp order flow](docs/screenshots/whatsapp-order.png)

## License

MIT — a `LICENSE` file should be added to the repository root.
