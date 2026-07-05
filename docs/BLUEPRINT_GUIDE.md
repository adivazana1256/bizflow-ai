# BizFlow AI — Business Blueprint Guide

How to build a new business on the framework with **template + client config only** — no Core changes. Proven with two very different businesses (Tony's Pizza, Galaxy Mobile) on the same engine.

Related: `docs/FRAMEWORK_ARCHITECTURE.md`, `docs/FLOW_ENGINE.md`.

---

## 1. What a blueprint is

A blueprint = a **template** (reusable per business type) + one or more **clients** (individual businesses).

- **Template** (`src/templates/<type>/`) — supported flows, required fields, default prompts, capabilities, reusable option groups.
- **Client** (`src/clients/<name>/`) — menu/products/services, prices, branding, hours, staff, phones, knowledge; names its `templateId`.
- The **loader** merges them into the `BusinessConfig` the engine runs. The engine never changes per business.

---

## 2. Map business needs to engine capabilities

The engine offers a fixed set of generic capabilities. Express every business need with one of them — do not add engine code.

| Need | Engine capability | How to configure |
|---|---|---|
| Answer questions / policies | **FAQ** | `knowledge` entries (title + content). Stem-matched. |
| "Do you have X?" / product info | **FAQ** | `knowledge` entries per product (stock + price). |
| Take an order / book a service | **Slot-filling flow** (`type: "order"`) | A `catalog` of items, optional option groups + add-ons, `quantity`, `customerFields`, and the `action` to emit. |
| Escalate to a person | **Handover** | `handover` rules (triggers are generic). |
| Greeting | **Greeting** | Automatic, uses `name` + the flow catalog for a menu. |

The slot-filling flow's `action` is configurable, so the same mechanism produces `create_order` (pizza) or `book_repair` (phone store) — the engine just emits `{ status, action, payload }`; an action handler in `src/server` interprets it.

### Worked example — Galaxy Mobile (phone store)

- **Product availability** (iPhone 16 Pro, Galaxy S26, Pixel 10) → `knowledge` entries with stock + price.
- **Warranty / Repair times / Store hours** → `knowledge`.
- **Repair Booking** → the slot-filling flow: `catalog` = repair services (priced), `quantity.required: false`, `customerFields` = device/name/phone, `action: "book_repair"`.
- **Human Handover** → generic.

Products (knowledge) and services (catalog) are disjoint, so "do you have an iPhone?" hits FAQ while "screen replacement" starts the repair flow — no collision.

---

## 3. Steps to add a business

1. **Template** — `src/templates/<type>/index.ts` exporting a `TemplateConfig`: `templateId`, `businessType`, `capabilities`, `persona.systemPrompt`, reusable `optionGroups`, and `flows` (structure only, no client data).
2. **Client** — `src/clients/<name>/index.ts` exporting a `ClientConfig` with `templateId`, identity, `hours`, `staff`, `knowledge`, `handover`, and `catalog` (prices in minor units; reference template option groups via `optionGroupRefs`).
3. **Wire** — point `src/config/index.ts` at `loadBusinessConfig(<template>, <client>)`.
4. **Run** — `npm run db:migrate && npm run db:seed`, then test on the Simulator.

Two businesses of the same type (e.g. `tonys-pizza`, `marios-pizza`) share the template and differ only in their client file.

---

## 4. Current limit & how to extend

**One slot-filling flow per deployment.** The engine runs a single `type: "order"` flow (plus FAQ/greeting/handover). That covers one primary transaction — ordering *or* booking *or* lead capture — not several at once.

Consequence for the phone store: **Repair Booking** is the active slot-filling flow. A dedicated autonomous **Lead Capture** flow (collect contact when a customer shows buy-intent) would be a *second* slot-filling flow, which the current engine does not run. It is the one need that cannot be met by config alone today.

To add multiple flows or a new flow type (lead, appointment, quote), extend the engine once — generically, per `docs/FLOW_ENGINE.md` §4:
- Support selecting among multiple flows (by trigger keywords / catalog match).
- Add a flow type with an optional catalog (pure field-collection for leads).

That is a one-time, business-agnostic Core addition — after it, lead/appointment/quote flows become config-only for every business.

---

## 5. Best practices

- **Template = structure, Client = data.** Same for every business of that type → template; this business's menu/prices/branding → client.
- **Availability & policy = knowledge; transactions = the flow.** Don't try to force Q&A facts into the slot flow.
- **Keep the engine generic.** Never put a product name or business word in `src/flow` or `src/ai` (there's a test asserting this).
- **Money in minor units** everywhere; format only for display.
- **Disjoint catalogs vs knowledge.** Keep flow catalog items and knowledge topics distinct so intent routing stays unambiguous.
- **Fail loud at load.** The loader throws on template mismatch or unknown option-group ref — catch config mistakes before serving traffic.
- **One action per flow.** Give each flow a distinct `action`; the matching handler lives in `src/server`.

---

*Proof: Galaxy Mobile (phone store) runs on the exact same Core as Tony's Pizza. Only a template, a client config, and one wiring line were added — no engine, transport, AI, server, db, or auth changes.*
