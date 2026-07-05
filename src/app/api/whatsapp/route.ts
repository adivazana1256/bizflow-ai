import { WhatsAppTransport } from "@/transport/whatsapp";

// WhatsApp webhook endpoint — SKELETON. Meta is NOT connected yet. The routes
// exist so the integration has a home; they return 501 until implemented.
const transport = new WhatsAppTransport();

// Meta webhook verification (GET hub.mode / hub.verify_token / hub.challenge).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = {
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  };
  try {
    const challenge = transport.verify(params);
    return new Response(challenge, { status: 200 });
  } catch {
    // Not connected yet.
    return new Response("WhatsApp transport not connected yet", { status: 501 });
  }
}

// Inbound messages (POST). When implemented this will verify the signature and
// call processInbound(transport, body, ctx).
export async function POST() {
  return new Response("WhatsApp transport not connected yet", { status: 501 });
}
