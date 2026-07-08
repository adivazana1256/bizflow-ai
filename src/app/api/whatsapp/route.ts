import { getDeploymentBusinessId } from "@/server/conversations";
import { processInbound } from "@/transport/handler";
import { splitWhatsAppWebhook, WhatsAppTransport } from "@/transport/whatsapp";

// WhatsApp Cloud API webhook. GET is Meta's verification handshake; POST
// delivers inbound messages (and status callbacks, which we no-op on).

export async function GET(req: Request) {
  const url = new URL(req.url);
  const transport = new WhatsAppTransport();
  const challenge = transport.verify({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });
  if (challenge === null) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { status: 200 });
}

export async function POST(req: Request) {
  // Raw text first — signature verification is over the exact bytes Meta sent.
  const rawBody = await req.text();

  // Signature check uses a throwaway transport instance; each message below
  // gets its own transport so a stashed conversation/business id from one
  // message never leaks into another.
  if (!new WhatsAppTransport().verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Always ack 200 once the signature checks out — Meta retries the webhook on
  // any non-2xx, and processInbound/receiveMessage's channel_message_id
  // dedup already makes a retried delivery a no-op. A queue/outbox would go
  // here if processing needed to survive a mid-request crash; not built.
  try {
    const body: unknown = JSON.parse(rawBody);
    const businessId = await getDeploymentBusinessId();
    // Meta can batch multiple messages into one delivery — process each, in
    // order, through the normal (idempotent) path. Status callbacks / non-text
    // deliveries split to zero messages and no-op, as before.
    for (const messageBody of splitWhatsAppWebhook(body)) {
      await processInbound(new WhatsAppTransport(), messageBody, { businessId });
    }
  } catch (e) {
    console.error("whatsapp webhook processing failed:", e);
  }

  return new Response("OK", { status: 200 });
}