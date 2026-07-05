# BizFlow AI — Framework Architecture

A reusable AI automation framework: one codebase, many clients. A client is a small **config** that inherits a **template**. The core engine never changes per client.

Related: `docs/FLOW_ENGINE.md`, `docs/CLIENT_ENGINE_SPEC.md`.

---

## 1. Folder structure

```
src/
  ai/            Core · AI dispatcher (mock now, Claude later) — src/ai/engine.ts
  flow/          Core · Flow Engine (business-agnostic) — types.ts, engine.ts
  server/        Core · Action handlers (e.g. create_order → DB) — orders.ts
  db/            Core · Database (schema, client)
  lib/           Core · Shared helpers (money, password)
  app/           Core · Approval Panel + Simulator + API routes

  config/
    types.ts     Template / Client / merged BusinessConfig contracts
    loader.ts    Package Loader — merges Template + Client
    index.ts     Active deployment = loadBusinessConfig(template, client)

  templates/
    pizza/       Template: supported flows, required fields, default prompts,
                 capabilities, reusable option groups (e.g. size)
    (clinic/ phone-store/ garage/ restaurant/ — add as needed)

  clients/
    tonys-pizza/ Client: menu, prices, branding, hours, delivery zones, staff,
                 phones, business knowledge
    (marios-pizza/ … — one folder per client)
```

**Core** = everything the framework provides (`ai`, `flow`, `server`, `db`, `lib`, `app`). It is business-agnostic and unchanged per client. **Templates** and **Clients** are pure data.

A **template** defines: supported flows, required fields, default prompts, business capabilities, reusable option groups.
A **client** defines: menu, prices, branding, opening hours, delivery zones, staff, phone numbers, business knowledge — and which template it inherits (`templateId`).

---

## 2. Loading process

```
templates/pizza (TemplateConfig)  ┐
                                  ├─►  loadBusinessConfig()  ──►  BusinessConfig  ──►  Flow Engine
clients/tonys-pizza (ClientConfig)┘        (config/loader.ts)      (merged shape)
```

`loadBusinessConfig(template, client)` (see `src/config/loader.ts`):

1. **Validate** `client.templateId === template.templateId` — throws on mismatch.
2. **Resolve catalog** — each client catalog item's `optionGroupRefs` (e.g. `["size"]`) are looked up in `template.optionGroups` and attached; inline `optionGroups` are appended. A missing ref throws.
3. **Inject catalog** into the template's order flow (template owns flow structure, client owns the menu).
4. **Merge fields** — identity/currency/timezone/hours/knowledge/handover/staff/branding/zones/phones from the client; `businessType` and default `persona` from the template (client may override persona).
5. **Return** a single `BusinessConfig` — the exact shape the Flow Engine already consumes. Nothing downstream (engine, simulator, persistence, seed) changed.

`src/config/index.ts` picks the active client for this deployment:

```ts
export const businessConfig = loadBusinessConfig(pizzaTemplate, tonysPizza);
```

---

## 3. How to add a template

1. Create `src/templates/<name>/index.ts` exporting a `TemplateConfig`:
   - `templateId`, `businessType`, `capabilities`.
   - `persona.systemPrompt` (default; clients may override).
   - `optionGroups` — reusable named groups clients reference.
   - `flows` — flow structure (types, actions, prompts, required/customer fields) **without** client data.
2. If the template needs a flow type that doesn't exist yet, add it to the engine first (see `docs/FLOW_ENGINE.md` §4).
3. Keep it business-generic across all clients of that type — no single client's menu or prices.

---

## 4. How to create a new client

1. Create `src/clients/<client>/index.ts` exporting a `ClientConfig` with `templateId` set to the template it inherits.
2. Fill client data: `name`, `currency`, `timezone`, `hours`, `staff`, `knowledge`, `handover`, `branding`, `phones`, `deliveryZones`, and `catalog` (menu + prices in minor units; reference template option groups via `optionGroupRefs`).
3. Point `src/config/index.ts` at the new client (one deployment = one client).
4. `npm run db:migrate && npm run db:seed`, then test on the Simulator.

Two clients of the same template (e.g. `tonys-pizza`, `marios-pizza`) share the template and differ only in their client files.

---

## 5. Best practices

- **Template = structure, Client = data.** If it's the same for every shop of that type, it belongs in the template; if it's this shop's menu/prices/branding, it belongs in the client.
- **Never put business specifics in `src/flow` or `src/ai`.** The engine must stay generic (there's a test asserting no product words in the engine).
- **Money in minor units** everywhere; format only for display (`src/lib/money.ts`).
- **Reference, don't duplicate.** Use `optionGroupRefs` so shared structures (sizes) live once in the template.
- **One deployment per client.** The deployment boundary is the tenant boundary (no multi-tenant DB).
- **Fail loud at load time.** The loader throws on template mismatch or an unknown option-group ref — catch config mistakes before serving traffic.
- **Keep actions in `src/server`.** Only action handlers know a payload's shape; the engine just emits `{ status, action, payload }`.

---

## 6. Future WhatsApp integration

Planned, not built. The seam is already in place:

- **Channel adapter** — a WhatsApp Cloud API adapter (webhook verify + receive + send) feeding the same `respond()` entry point the Simulator uses. The engine is channel-agnostic, so no engine changes.
- **Per-client numbers** — `ClientConfig.phones` already carries the client's number(s); the adapter maps an inbound number → the active deployment.
- **Integrations core** — a `src/integrations/` module will hold channel adapters and provider credentials (from env/secret store, never in client files). Webhook signatures verified; customer messages remain untrusted input gated by action authorization.
- **Delivery zones** — `ClientConfig.deliveryZones` is carried through for future order-routing/validation.

Until then, the Simulator exercises the full stack (flows, actions, approval panel) without WhatsApp.

---

*No authentication changes. No database schema changes. The Pizza implementation is now a template (`src/templates/pizza`) + a client (`src/clients/tonys-pizza`) merged by the loader into the same `BusinessConfig` the engine already used; the simulator works exactly as before.*
