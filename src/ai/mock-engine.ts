import type { BusinessConfig } from "../config/types";

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
export interface EngineResult {
  intent: string;
  status: string;
  summary?: unknown;
}
export interface EngineReply {
  reply: string;
  result?: EngineResult;
}

const HANDOVER_TRIGGERS = [
  "human",
  "agent",
  "representative",
  "real person",
  "speak to someone",
  "manager",
  "complaint",
  "refund",
  "angry",
];

const GREETING_RE = /^\s*(hi|hello|hey|yo|good (morning|afternoon|evening)|shalom)\b/i;
const NAME_RE = /(?:my name is|i am|i'm|name[:\s])\s+([A-Za-z][A-Za-z '-]{1,30})/i;
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function money(minor: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

// Deterministic, config-driven mock of the AI employee. Handles greeting, FAQ,
// single-item pizza ordering, and handover. Does NOT touch the DB.
// ponytail: single-item orders and keyword intent are enough to exercise the
// simulator; the real Claude tool-loop (multi-item, true NLU) lands with the AI
// engine phase.
export function runMockEngine(messages: ChatMessage[], config: BusinessConfig): EngineReply {
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastUser = userMsgs.at(-1)?.content ?? "";
  const lastLower = lastUser.toLowerCase();
  const allUser = userMsgs.map((m) => m.content).join("\n");
  const allLower = allUser.toLowerCase();

  // 1. Handover — highest priority.
  if (HANDOVER_TRIGGERS.some((t) => lastLower.includes(t))) {
    return {
      reply: `No problem — I'm connecting you with someone from ${config.name}. A team member will reply here shortly.`,
      result: { intent: "handover", status: "assigned_to_staff" },
    };
  }

  const products = config.catalog?.products ?? [];

  // Which catalog product (if any) is referenced across the conversation.
  const product = products.find((p) => allLower.includes(p.name.toLowerCase()));

  // 2. Greeting — only when the latest message is a greeting and no order started.
  if (GREETING_RE.test(lastUser) && !product) {
    const menu = products.map((p) => `• ${p.name} (${money(p.price, config.currency)})`).join("\n");
    return {
      reply:
        `Hi! Welcome to ${config.name}. I can take your order, answer questions, or connect you to a person.\n\n` +
        (menu ? `Here's our menu:\n${menu}\n\nWhat would you like?` : "How can I help?"),
    };
  }

  // 3. FAQ — match a knowledge entry by title/category keywords, tolerating word
  // stems ("deliver" vs "delivery") and punctuation.
  const knowledge = config.knowledge ?? [];
  const userTokens = (lastLower.match(/[a-z]+/g) ?? []).filter((t) => t.length >= 3);
  const faq = knowledge.find((k) => {
    const keys = (`${k.title} ${k.category ?? ""}`.toLowerCase().match(/[a-z]+/g) ?? []).filter(
      (w) => w.length >= 4,
    );
    return keys.some((kw) => userTokens.some((ut) => kw.startsWith(ut) || ut.startsWith(kw)));
  });
  if (faq && !product) {
    return { reply: faq.content };
  }

  // 4. Ordering — slot-fill from the whole conversation.
  if (product) {
    const variant = product.variants?.find((v) => allLower.includes(v.name.toLowerCase()));
    const extras = (product.extras ?? []).filter((e) => allLower.includes(e.name.toLowerCase()));

    // quantity: first digit, else a number word.
    const digit = allLower.match(/\b(\d{1,2})\b/);
    const word = Object.keys(NUMBER_WORDS).find((w) => allLower.includes(w));
    const quantity = digit ? Number(digit[1]) : word ? NUMBER_WORDS[word] : undefined;

    const nameMatch = allUser.match(NAME_RE);
    const customerName = nameMatch?.[1]?.trim();

    const needsSize = (product.variants?.length ?? 0) > 0 && !variant;
    if (needsSize) {
      const sizes = product.variants!.map((v) => v.name).join(", ");
      return { reply: `Great — one ${product.name}. What size? (${sizes})` };
    }
    if (!quantity) {
      return { reply: `How many ${product.name}${variant ? ` (${variant.name})` : ""} would you like?` };
    }
    if (!customerName) {
      return { reply: "Almost done — what name should I put the order under?" };
    }

    // All slots filled — build the summary. No DB write.
    const unitPrice =
      product.price + (variant?.priceDelta ?? 0) + extras.reduce((s, e) => s + e.priceDelta, 0);
    const lineTotal = unitPrice * quantity;

    const summary = {
      items: [
        {
          product: product.name,
          size: variant?.name ?? null,
          extras: extras.map((e) => e.name),
          quantity,
          unitPrice,
          lineTotal,
        },
      ],
      customerName,
      total: lineTotal,
      currency: config.currency,
    };

    return {
      reply:
        `Thanks, ${customerName}! Here's your order — sending it to ${config.name} for approval:\n\n` +
        `${quantity}× ${product.name}${variant ? ` (${variant.name})` : ""}` +
        `${extras.length ? ` + ${extras.map((e) => e.name).join(", ")}` : ""} — ${money(lineTotal, config.currency)}`,
      result: { intent: "create_order", status: "ready_for_approval", summary },
    };
  }

  // 5. Fallback.
  return {
    reply:
      `I can help you order, answer questions about ${config.name}, or connect you with a person. ` +
      `What would you like to do?`,
  };
}
