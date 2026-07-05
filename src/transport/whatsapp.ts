import { createHmac, timingSafeEqual } from "node:crypto";
import { appendMessage, getDeploymentBusinessId, getHistory, getOrCreateConversation } from "../server/conversations";
import type { InboundMessage, OutboundMessage, Transport } from "./types";

// WhatsApp Cloud API transport. Verifies the Meta webhook handshake and
// signature, maps the wire format to canonical InboundMessage/OutboundMessage,
// and persists conversation history via the Conversation Manager (the provider
// sends no history — we load it per conversation).

// Minimal shape of the parts of a Cloud API webhook body we read.
interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value?: {
        messages?: { from: string; id: string; type: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

interface ParsedInbound {
  from: string;
  text: string;
  wamid: string;
}

// ponytail: only the "text" message type is parsed. Other types (image, button,
// interactive, location...) are acknowledged (200, no reply) rather than
// crashing. Add per-type handling when a client needs it.
// Exported for offline unit testing (see docs/WHATSAPP_ARCHITECTURE.md §4); a
// pure function, no side effects.
export function parseWhatsAppWebhook(payload: unknown): ParsedInbound | null {
  const msg = (payload as WhatsAppWebhookBody)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || msg.type !== "text" || !msg.text?.body) return null;
  return { from: msg.from, text: msg.text.body, wamid: msg.id };
}

export class WhatsAppTransport implements Transport {
  channel = "whatsapp";

  // Stashed by receiveMessage for the paired sendMessage call. Create one
  // instance per request (see route.ts) — this is not safe to share across
  // concurrent webhook deliveries.
  private conversationId: string | null = null;
  private businessId: string | null = null;

  /** Meta webhook verification handshake. Returns the challenge, or null to reject. */
  verify(params: { mode: string | null; token: string | null; challenge: string | null }): string | null {
    if (params.mode === "subscribe" && params.challenge && params.token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return params.challenge;
    }
    return null;
  }

  /** HMAC-SHA256 of the raw body, compared to the X-Hub-Signature-256 header. */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret || !signatureHeader) return false;
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async receiveMessage(payload: unknown): Promise<InboundMessage> {
    const parsed = parseWhatsAppWebhook(payload);
    if (!parsed) {
      // Status callback (sent/delivered/read) or an unsupported message type —
      // nothing to run through the engine.
      return { channel: this.channel, from: "", text: "", history: [], raw: payload, duplicate: true };
    }
    const { from, text, wamid } = parsed;

    const businessId = await getDeploymentBusinessId();
    const conversation = await getOrCreateConversation(businessId, this.channel, from);
    // Prior turns only — fetched before the inbound message is stored below, so
    // processInbound's `[...history, latest]` doesn't double it up.
    const history = await getHistory(conversation.id);
    const { inserted } = await appendMessage(conversation.id, businessId, "user", text, wamid);

    this.businessId = businessId;
    this.conversationId = conversation.id;

    // inserted:false means this wamid was already stored — a re-delivered
    // webhook (Meta retries on non-2xx). Mark it so the handler no-ops instead
    // of replying to the customer twice.
    return { channel: this.channel, from, text, history, raw: payload, duplicate: !inserted };
  }

  async sendMessage(message: OutboundMessage): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";

    if (!token || !phoneNumberId) {
      console.error("WhatsAppTransport.sendMessage: missing WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID");
    } else {
      try {
        const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to,
            type: "text",
            text: { body: message.text },
          }),
        });
        if (!res.ok) {
          console.error(`WhatsAppTransport.sendMessage: Graph API ${res.status}`, await res.text().catch(() => ""));
        }
      } catch (e) {
        // Don't let a Graph API outage crash the webhook — Meta already got its 200.
        console.error("WhatsAppTransport.sendMessage: request failed", e);
      }
    }

    if (this.conversationId && this.businessId) {
      await appendMessage(this.conversationId, this.businessId, "assistant", message.text);
    }
  }
}