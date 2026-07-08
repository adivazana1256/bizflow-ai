import { randomUUID } from "node:crypto";
import { respond } from "../ai/engine";
import { savePendingOrder, type FlowPayload } from "../server/orders";
import { saveLead } from "../server/leads";
import { saveRepairBooking } from "../server/repairs";
import type { EngineReply } from "../flow/types";
import type { Transport } from "./types";

// Orchestrates one turn for any transport. This is the only place inbound
// messages reach the engine, and it does so exclusively through the Transport
// interface — so the engine never knows which channel a message came from.
export async function processInbound(
  transport: Transport,
  payload: unknown,
  ctx: { businessId?: string },
): Promise<EngineReply & { mock: boolean; saved: boolean }> {
  const inbound = await transport.receiveMessage(payload);

  // Re-delivered webhook (Meta retries on non-2xx) or a non-message payload
  // (e.g. a WhatsApp status callback): already handled, nothing to re-run.
  if (inbound.duplicate) {
    return { reply: "", mock: false, saved: false };
  }

  const messages = [...inbound.history, { role: "user" as const, content: inbound.text }];

  const out = await respond(messages);

  // Action handling: persist the completed action via its handler. Each
  // submission is keyed by the inbound provider message id (a repeat delivery
  // of the same wamid dedups) — never by content, so two different
  // submissions with identical details never collide (see server/orders.ts
  // etc.).
  let saved = false;
  if (out.result?.status === "completed" && ctx.businessId) {
    const businessId = ctx.businessId;
    const payload = out.result.payload as FlowPayload;
    const idempotencyKey = inbound.messageId ?? randomUUID();
    try {
      switch (out.result.action) {
        case "create_order":
          saved = (await savePendingOrder(businessId, payload, idempotencyKey)).saved;
          break;
        case "create_lead":
          saved = (await saveLead(businessId, payload, idempotencyKey)).saved;
          break;
        case "book_repair":
          saved = (await saveRepairBooking(businessId, payload, idempotencyKey)).saved;
          break;
      }
      if (!saved) console.warn(`action handler dedup-dropped (${out.result.action}), key=${idempotencyKey}`);
    } catch (e) {
      console.error(`action handler failed (${out.result.action}):`, e);
    }
  }

  await transport.sendMessage({
    channel: transport.channel,
    to: inbound.from,
    text: out.reply,
    result: out.result,
  });

  return { ...out, saved };
}
