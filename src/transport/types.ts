import type { ChatMessage, EngineResult } from "../flow/types";

// Transport layer. Every channel (Simulator, WhatsApp, future) implements this
// interface. It is the only thing that knows a channel's wire format; the flow
// engine only ever sees canonical InboundMessage/OutboundMessage.

export interface InboundMessage {
  channel: string; // "simulator" | "whatsapp" | ...
  from: string; // customer identifier (session id, phone number)
  text: string; // latest user message, normalized
  history: ChatMessage[]; // prior conversation state
  raw?: unknown; // original provider payload
}

export interface OutboundMessage {
  channel: string;
  to: string;
  text: string;
  result?: EngineResult;
}

export interface Transport {
  channel: string;
  /** Parse a channel-specific payload into a canonical inbound message. */
  receiveMessage(payload: unknown): Promise<InboundMessage>;
  /** Deliver a reply over the channel. */
  sendMessage(message: OutboundMessage): Promise<void>;
}
