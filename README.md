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

✅ Claude AI Employee Runtime &nbsp;·&nbsp; ✅ Live Tool Calling &nbsp;·&nbsp; ✅ WhatsApp Cloud API &nbsp;·&nbsp; ✅ Multi-Business Architecture &nbsp;·&nbsp; ✅ Approval Workflow &nbsp;·&nbsp; ✅ Hebrew Customer-Service Persona &nbsp;·&nbsp; ✅ Deterministic Fallback Mode &nbsp;·&nbsp; ✅ Simulator

## What it does

Customers message a business on WhatsApp. A **Claude-powered AI Employee** understands the natural-language request, selects and executes typed business tools from the Tool Registry (ordering, repair booking, lead capture, knowledge/FAQ, human handover), and replies as a real customer-service employee. Tool results are internal — the customer never sees raw tool output. Completed actions (`create_order`, `create_lead`, `book_repair`) are persisted as structured records, and the ones that need it await staff approval in an in-app Approval Panel; approving or rejecting sends a WhatsApp reply straight back to the customer.

If `ANTHROPIC_API_KEY` is not set, the app falls back to a deterministic, config-driven Execution Engine so it always works without an LLM.

Each deployment serves **one business**. The core is business-agnostic — a business is expressed as configuration ("client config" layered on a "template"), not as bespoke code.

## Main features

- Config-driven, multi-flow conversation engine (ordering, repair booking, lead capture, FAQ, handover)
- WhatsApp Cloud API transport with signature verification and idempotent webhook handling
- Structured persistence of conversations, orders, leads, and repair bookings in PostgreSQL
- Staff Approval Panel — approve/reject with details (e.g. pick an ETA or repair mode) and auto-reply to the customer
- In-app Simulator to exercise the same runtime and flows without a WhatsApp account
- **Claude AI Employee runtime** — a live tool-calling loop over the Tool Registry, using conversation history as short-term memory
- Tool Registry — 7 typed, zod-validated business actions, called live by Claude (and reused by the deterministic fallback)
- Deterministic Execution Engine as an automatic fallback when `ANTHROPIC_API_KEY` is missing
- Two working example blueprints: a pizza shop and a phone repair store

## Real end-to-end flow

```mermaid
flowchart TD
    A[Customer] --> B[WhatsApp]
    B --> C[Meta Cloud API]
    C --> D["Transport Layer\n(signature verify + wamid idempotency)"]
    D --> E[Conversation Manager]
    E --> F["🧠 Claude AI Employee\n(tool-calling loop)"]
    F --> G[Tool Registry]
    G --> H["Business Actions\n(create_order / create_lead / book_repair)"]
    H --> I[(PostgreSQL)]
    I --> J["Approval Panel\n(staff approve/reject)"]
    J --> K[WhatsApp reply]
    K --> A

    E -.-> M["Execution Engine\n(deterministic — fallback when\nANTHROPIC_API_KEY is missing)"]
    M -.-> G

    style M stroke-dasharray: 5 5
```

1. A customer sends a WhatsApp message to the business number.
2. Meta's Cloud API delivers it to the app's webhook.
3. The Transport Layer verifies the Meta signature (HMAC-SHA256) and dedups retries by `wamid` before anything else runs.
4. The Conversation Manager persists the inbound message and loads conversation history (used as Claude's short-term memory).
5. The **Claude AI Employee** reads the conversation, understands the request in natural language, and decides which typed tool(s) to call.
6. Claude calls tools from the **Tool Registry** live; tool results feed back into Claude's reasoning only — they are never shown to the customer.
7. When Claude calls a business action (`create_order`, `create_lead`, `book_repair`), the action handler persists structured data to PostgreSQL — created as pending where staff approval is required.
8. Staff review and approve/reject the record in the Approval Panel, optionally setting an ETA or repair mode.
9. The decision triggers a WhatsApp reply back to the customer.

When `ANTHROPIC_API_KEY` is not set (or a Claude call fails), the **deterministic Execution Engine** takes step 5 instead — keyword/slot-filling logic driven by the business's config — calling the same Tool Registry and action handlers. It is the fallback path, not the main one.

## Architecture overview

- **Template + Client config, merged by a loader.** A *template* (`src/templates/*`) defines a business type (pizza shop, phone store) — its flows, menu/catalog shape, and copy. A *client* (`src/clients/*`) supplies the specific business's data (Tony's Pizza, Galaxy Mobile). `src/config/loader.ts` merges the two into the single `businessConfig` the rest of the app reads.
- **Business-agnostic core.** The Execution Engine, transport, persistence, and Approval Panel code contain no business-specific logic — everything specific lives in config.
- **Single-tenant per deployment.** One business per running instance; the deployment itself is the isolation boundary. There is no multi-tenant database, no row-level security, no tenant switching.
- **Transport abstraction.** WhatsApp Cloud API is behind a transport interface (`src/transport`) so the Simulator can exercise the same Conversation Manager and runtime without touching WhatsApp.
- **Claude AI Employee runtime.** `src/ai/claude-brain.ts` runs a live Anthropic tool-calling loop: registry tools are converted to Claude tool definitions (`src/ai/tool-adapter.ts`), Claude selects and calls them, and conversation history is passed in as short-term memory. Active when `ANTHROPIC_API_KEY` is set.
- **Deterministic Execution Engine (fallback).** `src/flow/engine.ts` runs keyword/slot-filling logic against the merged config, calling the same Tool Registry and action handlers. It runs when `ANTHROPIC_API_KEY` is missing (or a Claude call fails), so the app works with no LLM.
- **Tool Registry.** `src/tools/*` defines 7 tools with metadata and zod input schemas. It is the single capability surface — called live by Claude and reused by the fallback engine; the AI never touches the database directly.

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
| `ANTHROPIC_API_KEY` | `your-anthropic-api-key` | Enables the Claude AI Employee runtime. **Leave unset to use deterministic fallback mode.** |
| `CLAUDE_MODEL` | `claude-opus-4-8` | Model used by the Claude runtime (override optional) |

WhatsApp credentials are optional for local development — the Simulator exercises the full runtime without them.

**Claude usage note:** the Claude AI Employee runtime calls the Anthropic API and requires your own **separate Anthropic API billing**. If `ANTHROPIC_API_KEY` is not set, BizFlow AI runs in **deterministic fallback mode** — no Anthropic calls, no LLM cost, all flows still work.

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

Its vision is to become an **AI Employee platform** — capable of performing real business tasks over WhatsApp through structured, typed business tools, not free-text scripts. That runtime is now live: Claude drives the conversation and calls the Tool Registry, with a deterministic engine as a dependable fallback. The next steps are durable memory, knowledge ingestion, and payments — see the roadmap.

## 🗺️ Roadmap

**Completed**
- ✅ WhatsApp Cloud API
- ✅ Conversation Manager
- ✅ Claude AI Employee Runtime
- ✅ Tool Registry
- ✅ Live Tool Calling
- ✅ Approval Panel
- ✅ Hebrew customer-service behavior
- ✅ Multi-business architecture

**Next**
- ⬜ Customer Memory
- ⬜ Business Memory
- ⬜ RAG / knowledge ingestion
- ⬜ Payment integrations
- ⬜ Appointment scheduling
- ⬜ Per-conversation locking
- ⬜ Reliable outbox / retries

Honest scope: BizFlow AI uses **conversation history as short-term memory only** — there is **no long-term customer/business memory, no RAG/knowledge ingestion, and no full autonomy** yet. Those are on the Next list. Today the AI operates one conversation at a time and creates records that staff approve where relevant.

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
