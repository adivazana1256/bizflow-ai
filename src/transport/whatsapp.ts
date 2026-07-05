import type { InboundMessage, OutboundMessage, Transport } from "./types";

// WhatsApp transport — SKELETON ONLY. Meta is NOT connected yet. This defines
// the shape (webhook verification, receive, send) so the wiring is ready; the
// bodies throw until the Meta integration is built.
//
// When implemented:
// - verify(): Meta webhook handshake — compare hub.verify_token to
//   WHATSAPP_VERIFY_TOKEN and echo hub.challenge.
// - receiveMessage(): parse a WhatsApp Cloud API webhook body into an
//   InboundMessage; history is loaded from the DB by conversation (the provider
//   does not send history).
// - sendMessage(): POST the reply to the Graph API
//   /{phone_number_id}/messages endpoint.
export class WhatsAppTransport implements Transport {
  channel = "whatsapp";

  /** Meta webhook verification handshake. Returns the challenge to echo. */
  verify(_params: { mode: string | null; token: string | null; challenge: string | null }): string {
    // TODO(meta): if mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN
    //             return challenge; else reject.
    throw new Error("WhatsAppTransport.verify not implemented — Meta not connected yet");
  }

  async receiveMessage(_payload: unknown): Promise<InboundMessage> {
    // TODO(meta): parse Cloud API webhook payload → InboundMessage; load history
    // from the DB for this conversation.
    throw new Error("WhatsAppTransport.receiveMessage not implemented — Meta not connected yet");
  }

  async sendMessage(_message: OutboundMessage): Promise<void> {
    // TODO(meta): POST to https://graph.facebook.com/<ver>/<phone_number_id>/messages
    //             with the reply text and an auth token from env.
    throw new Error("WhatsAppTransport.sendMessage not implemented — Meta not connected yet");
  }
}
