import { respond } from "../ai/engine";
import { savePendingOrder, type FlowPayload } from "../server/orders";
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
  const messages = [...inbound.history, { role: "user" as const, content: inbound.text }];

  const out = await respond(messages);

  // Action handling (unchanged business logic): persist a completed order.
  let saved = false;
  if (out.result?.action === "create_order" && out.result.status === "completed" && ctx.businessId) {
    try {
      saved = (await savePendingOrder(ctx.businessId, out.result.payload as FlowPayload)).saved;
    } catch (e) {
      console.error("savePendingOrder failed:", e);
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
