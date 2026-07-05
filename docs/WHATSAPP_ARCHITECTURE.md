# BizFlow AI — WhatsApp Architecture (Phase 4)

The WhatsApp Cloud API transport, connected. Builds on `docs/TRANSPORT_LAYER.md`
— read that first. The Flow Engine is unchanged; this only fills in
`WhatsAppTransport` + a Conversation Manager + the webhook route.

---

## 1. Pieces

```
Meta ──POST──► /api/whatsapp (route.ts)
                 │ verify X-Hub-Signature-256
                 ▼
             WhatsAppTransport.receiveMessage(body)
                 │ parse wa_id/text/wamid
                 │ getOrCreateConversation (Conversation Manager)
                 │ getHistory (prior turns)
                 │ appendMessage(user, wamid)  ← idempotency check
                 ▼
             processInbound() ──► respond() (Flow Engine, channel-blind)
                 │
                 ├─ action handler (create_order / create_lead / book_repair)
                 │  — unchanged, already idempotent via source_key
                 ▼
             WhatsAppTransport.sendMessage(reply)
                 │ POST Graph API /{phone_number_id}/messages
                 │ appendMessage(assistant)
                 ▼
             Meta ──► customer's WhatsApp
```

- **Conversation Manager** (`src/server/conversations.ts`) — the only place that
  touches the new `conversations`/`messages` tables. Resolves the single
  deployment's business id, gets-or-creates a conversation per
  `(business, channel, external_id)`, appends messages, loads history.
- **WhatsAppTransport** (`src/transport/whatsapp.ts`) — implements `Transport`
  (same interface as `SimulatorTransport`). Adds `verify()` and
  `verifySignature()` for the webhook lifecycle.
- **Webhook route** (`src/app/api/whatsapp/route.ts`) — Next.js route handler,
  GET for verification, POST for inbound messages.

---

## 2. Webhook lifecycle

### Verify (GET)

Meta calls `GET /api/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
once, when you save the webhook config in the Meta App Dashboard.
`transport.verify()` checks `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN`
and echoes `hub.challenge` back as plain text (200). Anything else → 403.

### Inbound (POST)

1. Read the **raw** body (signature is over the exact bytes).
2. Verify `X-Hub-Signature-256: sha256=<hex>` — HMAC-SHA256 of the raw body
   with `WHATSAPP_APP_SECRET`, compared with `crypto.timingSafeEqual`. Mismatch
   → 401 (no processing).
3. `JSON.parse` the body, resolve the single deployment's business id, and run
   `processInbound(transport, body, { businessId })` — same orchestrator the
   Simulator uses.
4. Always return 200 once the signature checks out, even if processing threw
   (logged, not surfaced). See §4.

`WhatsAppTransport.receiveMessage`:
- Parses `entry[0].changes[0].value.messages[0]` — only `type: "text"` is
  handled (`text.body`); other types (image, button, interactive, location...)
  and status callbacks (`statuses[]`, no `messages[]`) are acknowledged with
  no reply. *(ponytail: extend `parseWhatsAppWebhook` per-type when a client
  needs it.)*
- Resolves/creates the conversation for the sender's `wa_id`, loads prior
  history, then stores the inbound message keyed by the WhatsApp message id
  (`wamid`).
- Returns the canonical `InboundMessage`. If the wamid was already stored
  (retry), `duplicate: true` is set and `processInbound` returns immediately
  without calling the engine or sending a reply again.

`WhatsAppTransport.sendMessage`: POSTs
`https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`
with `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`, then stores the
assistant's reply via the Conversation Manager (no wamid — outbound messages
aren't deduped, there's nothing to dedupe against).

---

## 3. Security

- **Verify token** (`WHATSAPP_VERIFY_TOKEN`) — proves the webhook subscription
  request came from your Meta App config, not an unrelated actor guessing the
  URL.
- **X-Hub-Signature-256** (`WHATSAPP_APP_SECRET`) — proves each POST body
  actually came from Meta and wasn't tampered with in transit. Checked before
  any parsing or DB write.
- **Customer text is untrusted input** — it only ever reaches the engine as a
  string in `ChatMessage[]`; it can't reach the DB except through the action
  handlers (`src/server/orders.ts` etc.), which validate the flow-engine
  payload shape, not raw customer text.

---

## 4. Retry strategy & idempotency

Meta retries a webhook delivery if the endpoint doesn't return 2xx (with
backoff, for a limited window). Two consequences:

- **We return 200 fast, after processing.** No queue/outbox in front of
  processing — this is a single-tenant, moderate-volume deployment, so
  in-request processing is the simplest thing that works. *(ponytail: if a
  client needs to survive a mid-request crash/timeout without ever risking a
  late/duplicate reply, that's where a queue with an ack-after-success outbox
  would go — not built, add if latency/volume needs it.)*
- **Idempotency via wamid.** `messages.(business_id, channel_message_id)` has
  a unique index (Postgres treats `NULL` values as distinct, so Simulator rows
  with no wamid are never affected). A retried webhook hits the same wamid,
  `appendMessage` no-ops (`onConflictDoNothing`), `receiveMessage` marks the
  inbound `duplicate: true`, and `processInbound` returns without re-running
  the engine, re-saving an action, or re-sending a WhatsApp reply. Action
  handlers (`create_order`/`create_lead`/`book_repair`) are separately
  idempotent via their own `source_key`, so even a duplicate reaching the
  engine wouldn't double-write — the wamid check just avoids the redundant
  work and, more importantly, a second WhatsApp message to the customer.

---

## 5. Two channels, one engine

Simulator and WhatsApp both call `processInbound()`; the Flow Engine never
sees which one. The "switch" is just which endpoint receives traffic:

- `/api/chat` → `SimulatorTransport` — used by the in-app chat simulator.
- `/api/whatsapp` → `WhatsAppTransport` — used by Meta.

Both persist through the same `respond()`/action-handler path; only
`WhatsAppTransport` additionally persists conversation history (the Simulator
posts its own full history each turn, so it doesn't need the DB for that).

---

## 6. Future Instagram / Messenger

Same shape as WhatsApp — Meta's Graph API webhooks for Instagram DMs and
Messenger use the same `entry[].changes[].value` envelope (different fields
inside). A new `InstagramTransport`/`MessengerTransport` would:

- Reuse the Conversation Manager as-is (`channel: "instagram"` etc. — the
  `(business, channel, external_id)` key already supports multiple channels
  per business).
- Implement `verify`/`verifySignature`/`receiveMessage`/`sendMessage` for that
  provider's wire format, feeding the same `processInbound()`.
- No Flow Engine or action-handler changes — the seam is the `Transport`
  interface, already proven by Simulator + WhatsApp coexisting.

---

*No engine changes. No changes to `src/flow/**`, `src/templates/**`,
`src/clients/**`, `src/ai/engine.ts`, the approval panel, or the action
handlers. New: `conversations`/`messages` tables, the Conversation Manager,
`WhatsAppTransport`, and the webhook route.*
