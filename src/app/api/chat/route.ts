import { NextResponse } from "next/server";
import { respond, type ChatMessage } from "@/ai/engine";
import { auth } from "@/lib/auth";
import { savePendingOrder, type OrderSummary } from "@/server/orders";

// Chat Simulator backend. Stateless: the client sends the full message history.
// When the engine returns a completed order, it is saved as a pending order.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.messages) ? body.messages : [];

  const messages: ChatMessage[] = raw
    .filter(
      (m: unknown): m is ChatMessage =>
        !!m &&
        typeof (m as ChatMessage).content === "string" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant"),
    )
    .map((m: ChatMessage) => ({ role: m.role, content: m.content }));

  const out = await respond(messages);

  let saved = false;
  if (out.result?.intent === "create_order" && out.result.status === "ready_for_approval") {
    const session = await auth();
    if (session?.user.businessId) {
      try {
        const r = await savePendingOrder(session.user.businessId, out.result.summary as OrderSummary);
        saved = r.saved;
      } catch (e) {
        console.error("savePendingOrder failed:", e);
      }
    }
  }

  return NextResponse.json({ ...out, saved });
}
