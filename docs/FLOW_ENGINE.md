# BizFlow AI — Flow Engine

A reusable, configuration-driven engine that executes business flows from a conversation. The engine contains **no business-specific logic** — a business (pizza shop, clinic, garage) is only a `BusinessConfig`. Pizza is one example config.

Related: `docs/CLIENT_ENGINE_SPEC.md`, `docs/PIVOT_PLAN.md`.

---

## 1. Architecture

```
Simulator / WhatsApp
        │  messages (conversation state)
        ▼
src/ai/engine.ts      respond()  — dispatcher (mock now, Claude later)
        │
        ▼
src/flow/engine.ts    runFlowEngine(messages, config)  — generic, no business knowledge
        │  { reply, result? }
        ▼
src/app/api/chat/route.ts        on a terminal action, calls the action handler
        │
        ▼
src/server/orders.ts  savePendingOrder()  — action handler for "create_order"
```

Layers and what each may know:

| Layer | File | Knows about |
|---|---|---|
| Config | `src/config/*` | Everything about ONE business — as data only. |
| Flow types | `src/flow/types.ts` | The generic vocabulary: items, option groups, add-ons, customer fields, flows. |
| Flow engine | `src/flow/engine.ts` | How to run flows + greeting/FAQ/handover. **No business or product names.** |
| Dispatcher | `src/ai/engine.ts` | Whether to use the mock engine or (later) Claude. |
| Action handlers | `src/server/*` | The payload shape of a specific action (e.g. `create_order` → DB). |

The engine is business-agnostic; only config and action handlers carry specifics. (A test asserts `src/flow/engine.ts` contains no words like "pizza".)

---

## 2. Flow lifecycle

For each incoming turn the engine receives the full conversation (stateless) and runs, in order:

1. **Handover** — if `handover.onRequest`/`onComplaint` and the last message hits a trigger word → `{ status: "handover", action: "handover" }`.
2. **Greeting** — a greeting with no order in progress → welcome + menu (menu is derived generically from the order flow's catalog).
3. **FAQ** — generic keyword/stem match against `knowledge` → the entry's content.
4. **Flow execution** — for the Order flow (see below). Other flow types plug in here.
5. **Fallback** — a generic "what would you like to do?".

### Order flow slot-filling

The engine derives state from the whole conversation and asks only for what's missing:

1. **Item** — find a catalog item mentioned. If none, the order flow yields (engine falls through).
2. **Option groups** — for each `required` group without a choice → ask its prompt (e.g. size). Optional groups skipped.
3. **Add-ons** — collected if mentioned; never required.
4. **Quantity** — if `required` and absent → ask.
5. **Customer fields** — for each `required` field without a value → ask its prompt. Extraction is generic: `"<field> is X"`, `"my <field> is X"`, `"<field>: X"`, or the reply right after the field's prompt.
6. **Completion** — compute price (base + option deltas + add-on deltas) × quantity, all in **minor units**, and return:

```json
{
  "status": "completed",
  "action": "create_order",
  "payload": {
    "items": [{ "name": "...", "options": { "size": "Large" }, "addOns": ["..."],
                "quantity": 2, "unitPrice": 1750, "lineTotal": 3500 }],
    "customer": { "name": "Sam" },
    "total": 3500,
    "currency": "USD"
  }
}
```

The route matches `action === "create_order" && status === "completed"` and calls the `create_order` handler (`savePendingOrder`), which maps the payload to the DB as a **pending** order. The engine itself never writes to the DB.

---

## 3. How to add a new business

1. Copy `src/config/pizza.ts` → `src/config/<client>.ts`.
2. Edit the data: `name`, `currency`, `timezone`, `hours`, `persona`, `knowledge`, `handover`, `staff`.
3. Define `flows` — for ordering, list catalog `items` with their `optionGroups`, `addOns`, `quantity`, and `customerFields`. Prices in minor units.
4. Point `src/config/index.ts` at the new config.
5. `npm run db:migrate && npm run db:seed`, then test on the Simulator.

No engine code changes. The engine runs whatever the config declares.

---

## 4. How to add a new flow

1. Add the flow's config interface to `src/flow/types.ts` and extend the `Flow` union (e.g. `AppointmentFlowConfig` with `type: "appointment"`).
2. Add a `run<Name>Flow(...)` function in `src/flow/engine.ts` that does generic slot-filling for that flow and returns `{ reply, result? }` (or `null` to yield). Wire it into `runFlowEngine`'s flow-execution step, selected by `type`.
3. Choose the completion `action` string (e.g. `book_appointment`) and add its handler in `src/server/` (the only place that knows that action's payload shape).
4. Add the flow to a business config's `flows` array with its required fields, completion rules, and action.

Keep all field lists, prompts, options, and completion rules in config — the engine stays generic.

---

*Refactor note: the former pizza-specific `src/ai/mock-engine.ts` is gone; its behaviour now lives in the generic `src/flow/engine.ts`, driven entirely by `src/config/pizza.ts`. The simulator and pending-order persistence work unchanged against the new `{ status, action, payload }` result shape.*
