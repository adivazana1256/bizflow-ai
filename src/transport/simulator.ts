import type { ChatMessage } from "../flow/types";
import type { InboundMessage, OutboundMessage, Transport } from "./types";

// Simulator transport. The web simulator posts the full message history; the
// latest user message is the inbound text and the rest is history.
export class SimulatorTransport implements Transport {
  channel = "simulator";

  async receiveMessage(payload: unknown): Promise<InboundMessage> {
    const raw = (payload as { messages?: unknown })?.messages;
    const messages: ChatMessage[] = (Array.isArray(raw) ? raw : [])
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof (m as ChatMessage).content === "string" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant"),
      )
      .map((m: ChatMessage) => ({ role: m.role, content: m.content }));

    const last = messages.at(-1);
    const text = last?.role === "user" ? last.content : "";
    const history = last?.role === "user" ? messages.slice(0, -1) : messages;

    return { channel: this.channel, from: "simulator", text, history, raw: payload };
  }

  async sendMessage(_message: OutboundMessage): Promise<void> {
    // The simulator is synchronous request/response: the reply is returned in the
    // HTTP response by the route (using processInbound's return value), so there
    // is no out-of-band delivery. No-op by design.
  }
}
