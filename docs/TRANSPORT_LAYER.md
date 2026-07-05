# BizFlow AI — Transport Layer

Channels (Simulator, WhatsApp, future) are decoupled from the flow engine by a Transport interface. The engine never knows where a message came from.

Related: `docs/FLOW_ENGINE.md`, `docs/FRAMEWORK_ARCHITECTURE.md`.

---

## 1. Architecture

```
                 ┌────────────────────────────┐
  Simulator ───► │ SimulatorTransport         │ ┐
  (web)          │  receiveMessage/sendMessage│ │
                 └────────────────────────────┘ │   processInbound()          respond()
                 ┌────────────────────────────┐ ├──► (transport/handler.ts) ──► Flow Engine
  WhatsApp  ───► │ WhatsAppTransport (skeleton)│ │        canonical messages      (channel-blind)
  (Meta)         │  verify/receive/send       │ ┘
                 └────────────────────────────┘
```

The `Transport` interface (`src/transport/types.ts`):

```ts
interface Transport {
  channel: string;
  receiveMessage(payload): Promise<InboundMessage>;   // provider wire format → canonical
  sendMessage(message: OutboundMessage): Promise<void>; // deliver a reply
}
```

- `InboundMessage` = `{ channel, from, text, history, raw? }` — the canonical shape the engine consumes.
- `OutboundMessage` = `{ channel, to, text, result? }`.

**Orchestrator** (`src/transport/handler.ts`): `processInbound(transport, payload, ctx)` is the single path from a channel to the engine:

1. `transport.receiveMessage(payload)` → canonical inbound.
2. Build messages (`history + latest text`) and call `respond()` (the engine).
3. Run action handlers (e.g. persist a completed order) — unchanged business logic.
4. `transport.sendMessage(reply)` — channel delivery.

The engine only ever receives canonical messages via this path, so it is blind to the channel. (Tests assert `src/flow/engine.ts` contains no `transport`/`whatsapp`/`simulator`/`webhook` words.)

### Implementations

- **SimulatorTransport** (`src/transport/simulator.ts`) — live. The web simulator posts the full history; the latest user message becomes `text`, the rest `history`. Synchronous request/response, so `sendMessage` is a no-op (the reply is returned in the HTTP response by `/api/chat`).
- **WhatsAppTransport** (`src/transport/whatsapp.ts`) — **skeleton only, Meta not connected**. Defines `verify`, `receiveMessage`, `sendMessage`; each throws until implemented. Webhook endpoint at `src/app/api/whatsapp/route.ts` returns `501` for now.

---

## 2. How WhatsApp will connect

No engine changes — only `WhatsAppTransport` and its webhook are filled in.

1. **Verification** — Meta sends `GET /api/whatsapp?hub.mode&hub.verify_token&hub.challenge`. `verify()` checks the token against `WHATSAPP_VERIFY_TOKEN` and echoes `hub.challenge`.
2. **Receive** — Meta `POST`s the Cloud API webhook body. The route validates the payload signature (`X-Hub-Signature-256`), then `receiveMessage()` parses it into an `InboundMessage`. History is loaded from the DB for that conversation (the provider does not send history).
3. **Process** — the same `processInbound(whatsappTransport, body, ctx)` runs the engine and action handlers.
4. **Send** — `sendMessage()` POSTs the reply to the Graph API `/{phone_number_id}/messages`, using a token from env.
5. **Routing** — inbound phone number → the active deployment/client (`ClientConfig.phones`).

Secrets (verify token, access token, phone number id) come from env / a secret store — never from client config files.

---

## 3. Future channels

Any channel is a new `Transport` implementation; nothing else changes:

- **Instagram / Messenger** — Meta Graph webhooks, same shape as WhatsApp.
- **SMS** (Twilio) — webhook in, REST out.
- **Web chat widget** — like the simulator but embedded on a client's site.

Each maps its wire format to `InboundMessage`/`OutboundMessage` and reuses `processInbound`. The engine and flows are untouched.

---

## 4. Testing strategy

- **Engine/flows** — test `runFlowEngine` directly with canonical messages (no transport). Deterministic, offline.
- **Transport parsing** — unit-test each transport's `receiveMessage` (payload → `InboundMessage`) and `sendMessage` in isolation.
- **End-to-end without a provider** — the SimulatorTransport is the test harness: drive full conversations through `/api/chat` and the approval panel without WhatsApp.
- **WhatsApp** — until Meta is connected, feed recorded Cloud API webhook payloads into `WhatsAppTransport.receiveMessage` to test parsing; mock the Graph API for `sendMessage`; verify signature checking and the `verify()` handshake. No live Meta account needed for these.
- **Channel-blindness guard** — a check asserting the engine source contains no channel/transport identifiers, so business logic can't leak a channel dependency.

---

*Meta not connected. Business logic unchanged — this adds a transport seam in front of the engine; the Simulator behaves exactly as before, now routed through `SimulatorTransport`.*
