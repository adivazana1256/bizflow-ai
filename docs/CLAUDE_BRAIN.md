# BizFlow AI — Claude Brain (AI-Employee runtime)

Replaces the deterministic engine as the primary decision-maker for a chat turn, using the existing Tool Registry (`src/tools/**`) as the only capability surface. The deterministic engine (`src/flow/engine.ts`) stays as-is and is the fallback.

Related: `docs/CLIENT_ENGINE_SPEC.md` §5, `docs/FLOW_ENGINE.md`.

---

## 1. Dispatcher

`src/ai/engine.ts` `respond(messages, ctx?)`:

- If `ANTHROPIC_API_KEY` is set **and** a `ToolContext` with `businessId` is passed → dynamically imports and calls `respondWithClaude` (`src/ai/claude-brain.ts`). Any error there is caught and falls back to the deterministic engine.
- Otherwise (no key, or no ctx — e.g. logged-out simulator session) → runs `runFlowEngine` exactly as before and returns `mock: true`.

The SDK is only ever imported (`import("./claude-brain")`) when a key is present, so no Anthropic call is possible without one.

`src/transport/handler.ts` builds the `ToolContext` from the inbound message (`businessId`, `channel`, `externalId` = `inbound.from`, `idempotencyKey` = `inbound.messageId` or a fresh UUID) and passes it to `respond`. That's the only change to `processInbound` — action persistence and `sendMessage` are untouched.

---

## 2. The tool loop

`src/ai/claude-brain.ts` `respondWithClaude(messages, ctx)`:

1. `src/ai/tool-adapter.ts` `toClaudeTools(toolRegistry.list())` converts every registered `Tool` (Zod `inputSchema`) into a Claude tool definition via `zod-to-json-schema`.
2. System prompt = `businessConfig.persona.systemPrompt` + `businessConfig.name` + the safety rules (§3 below).
3. Call `client.messages.create({ model, max_tokens: 1024, system, messages, tools })` (no `temperature`/`thinking`).
4. While `stop_reason === "tool_use"`: push the assistant turn, run each `tool_use` block through `executeToolCall(name, input, ctx)` (validates input with the tool's own Zod schema, executes it, never throws — returns `{ error }` on failure so Claude can recover), push all `tool_result` blocks as one user turn, loop again (capped at 8 iterations).
5. Stop on any other `stop_reason` and return the concatenated `text` blocks as `reply`.

Tools already persist through `ctx` (`create_order`/`create_lead`/`book_repair` call the same `src/server/*.ts` handlers the deterministic engine uses). `respondWithClaude` never returns a `result` with `status: "completed"`, so `processInbound`'s action-persistence block (which only fires on that shape) never double-saves. The one exception: `handover_to_human` returns `result: { status: "handover", action: "handover" }`, which `processInbound` doesn't persist — it's just a signal.

---

## 3. Safety model

Structural, not just prompted:

- No refund/payment/approve tool exists in the registry — the AI cannot approve or pay out anything no matter what it's told, because there is no tool call that does it.
- Orders/bookings can only be *created pending*, same as the deterministic flow — staff approval still happens in the Approval Panel, unchanged.

Prompted (system prompt, `src/ai/claude-brain.ts` `SAFETY_RULES`):

- Only state prices/products/availability returned by `search_products`/`search_knowledge` — never invent them.
- Never approve orders/bookings, never refund/pay.
- Call `handover_to_human` when uncertain, on a complaint, or when asked for a person.
- Ask for missing required fields before creating an order/lead/booking.

---

## 4. Memory

Short-term only: the full `ChatMessage[]` history (built by `processInbound` from the transport's stored history + the latest message) is passed in on every turn and mapped straight to Anthropic `messages`. No separate memory store.

---

## 5. Env vars

```
ANTHROPIC_API_KEY=your-anthropic-api-key   # unset → deterministic engine only, no Claude calls
CLAUDE_MODEL=claude-opus-4-8               # optional override
```

---

## 6. Testing locally

**Without a key (deterministic engine, default):**

```
npm run dev
```

Open the simulator, log in, drive a normal order/booking conversation — identical to before, response includes `mock: true`.

**With a key (Claude tool loop):**

1. Set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`) in `.env`.
2. `npm run dev`, log in, use the simulator on a business with `businessId` in session.
3. Ask about a product/price — Claude should call `search_products`/`search_knowledge` rather than inventing an answer.
4. Ask to order/book without giving your name/phone — Claude should ask for it before calling `create_order`/`book_repair`.
5. Ask for a refund or to speak to a person — Claude should call `handover_to_human` (there is no refund tool to call).
6. Response has `mock: false`; a created order/booking shows up pending in the Approval Panel exactly as the deterministic path produces.

If the Claude call errors (bad key, network), the turn falls back to the deterministic engine automatically (check server logs for the fallback warning) and still replies.