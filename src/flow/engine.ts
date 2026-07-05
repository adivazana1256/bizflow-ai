import { formatMoney } from "../lib/money";
import type { BusinessConfig } from "../config/types";
import type { ChatMessage, EngineReply, FlowConfig } from "./types";

// Business-agnostic flow engine. Supports multiple slot-filling flows per
// deployment, selected by trigger phrases / catalog mentions, plus the
// cross-cutting behaviours greeting / FAQ / handover. No business specifics.

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
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function runFlowEngine(messages: ChatMessage[], config: BusinessConfig): EngineReply {
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastUser = userMsgs.at(-1)?.content ?? "";
  const lastLower = lastUser.toLowerCase();
  const allUser = userMsgs.map((m) => m.content).join("\n");
  const allLower = allUser.toLowerCase();

  // 1. Handover — highest priority.
  if (
    (config.handover.onRequest || config.handover.onComplaint) &&
    HANDOVER_TRIGGERS.some((t) => lastLower.includes(t))
  ) {
    return {
      reply: `No problem — I'm connecting you with someone from ${config.name}. A team member will reply here shortly.`,
      result: { status: "handover", action: "handover" },
    };
  }

  // 2. Select the active flow (sticky across turns). A flow that already
  // completed in this conversation is released, so it does not re-emit its
  // result on later messages (M2 terminal guard).
  let flow = selectFlow(allLower, messages, config.flows);
  if (flow && alreadyCompleted(flow, messages)) flow = undefined;

  // 3. Greeting — only when no flow is engaged.
  if (!flow && GREETING_RE.test(lastUser)) {
    const menu = catalogMenu(config);
    return {
      reply:
        `Hi! Welcome to ${config.name}. I can help you, answer questions, or connect you to a person.` +
        (menu ? `\n\n${menu}\n\nWhat would you like?` : ""),
    };
  }

  // 4. FAQ — only when no flow is engaged.
  if (!flow) {
    const faq = matchFaq(lastLower, config);
    if (faq) return { reply: faq };
  }

  // 5. Run the selected flow.
  if (flow) return runFlow(messages, allUser, allLower, flow, config);

  // 6. Fallback.
  return {
    reply: `I can help you, answer questions about ${config.name}, or connect you with a person. What would you like to do?`,
  };
}

// ---- flow selection ----

function flowPrompts(flow: FlowConfig): string[] {
  const prompts = flow.fields.map((f) => f.prompt);
  if (flow.itemPrompt) prompts.push(flow.itemPrompt);
  if (flow.quantity?.prompt) prompts.push(flow.quantity.prompt);
  for (const item of flow.catalog ?? []) {
    for (const g of item.optionGroups ?? []) if (g.prompt) prompts.push(g.prompt);
  }
  return prompts;
}

// Word-boundary phrase match, so a trigger/item does not match inside another
// word ("order" must not fire on "in order to", "get" not on "budget").
function hasPhrase(text: string, phrase: string): boolean {
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(phrase.toLowerCase())}(?![a-z0-9])`, "i");
  return re.test(text);
}

function flowMatches(flow: FlowConfig, allLower: string): boolean {
  if ((flow.triggers ?? []).some((t) => hasPhrase(allLower, t))) return true;
  return (flow.catalog ?? []).some((i) => hasPhrase(allLower, i.name));
}

// A flow is terminal if a stable literal segment of its completion reply already
// appears in the assistant history — i.e. it completed on an earlier turn.
function alreadyCompleted(flow: FlowConfig, messages: ChatMessage[]): boolean {
  const literal = flow.completionReply
    .split(/\{\w+\}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .sort((a, b) => b.length - a.length)[0];
  if (!literal) return false;
  return messages.some((m) => m.role === "assistant" && m.content.includes(literal));
}

function selectFlow(allLower: string, messages: ChatMessage[], flows: FlowConfig[]): FlowConfig | undefined {
  const assistantSaid = new Set(messages.filter((m) => m.role === "assistant").map((m) => m.content));
  // In-progress wins: a flow whose prompt was already asked stays selected.
  for (const f of flows) {
    if (flowPrompts(f).some((p) => assistantSaid.has(p))) return f;
  }
  // Otherwise first flow whose trigger/catalog appears in the conversation.
  for (const f of flows) {
    if (flowMatches(f, allLower)) return f;
  }
  return undefined;
}

// ---- cross-cutting behaviours ----

function catalogMenu(config: BusinessConfig): string {
  const withCatalog = config.flows.find((f) => (f.catalog?.length ?? 0) > 0);
  if (!withCatalog?.catalog) return "";
  return withCatalog.catalog
    .map((i) => `• ${i.name} (${formatMoney(i.price, config.currency)})`)
    .join("\n");
}

function matchFaq(lastLower: string, config: BusinessConfig): string | undefined {
  const knowledge = config.knowledge ?? [];
  const userTokens = (lastLower.match(/[a-z]+/g) ?? []).filter((t) => t.length >= 3);
  const faq = knowledge.find((k) => {
    const keys = (`${k.title} ${k.category ?? ""}`.toLowerCase().match(/[a-z]+/g) ?? []).filter(
      (w) => w.length >= 4,
    );
    return keys.some((kw) => userTokens.some((ut) => kw.startsWith(ut) || ut.startsWith(kw)));
  });
  return faq?.content;
}

// ---- generic slot-filling ----

function parseNumber(text: string): number | undefined {
  const d = text.match(/\b(\d{1,2})\b/);
  if (d) return Number(d[1]);
  const w = Object.keys(NUMBER_WORDS).find((x) => text.includes(x));
  return w ? NUMBER_WORDS[w] : undefined;
}

function extractField(
  field: { name: string; prompt: string },
  messages: ChatMessage[],
  allUser: string,
): string | undefined {
  const re = new RegExp(`(?:my )?${escapeRe(field.name)}\\s*(?:is|:)\\s*([\\p{L}][\\p{L} '-]{1,40})`, "iu");
  const m = allUser.match(re);
  if (m) return m[1].trim();

  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "assistant" && messages[i].content === field.prompt && messages[i + 1].role === "user") {
      return messages[i + 1].content.trim();
    }
  }
  return undefined;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function runFlow(
  messages: ChatMessage[],
  allUser: string,
  allLower: string,
  flow: FlowConfig,
  config: BusinessConfig,
): EngineReply {
  // Item (if this flow uses a catalog).
  const catalog = flow.catalog ?? [];
  const item = catalog.length ? catalog.find((i) => allLower.includes(i.name.toLowerCase())) : undefined;
  if (catalog.length && flow.itemRequired !== false && !item) {
    return { reply: flow.itemPrompt ?? "What would you like?" };
  }

  const options: Record<string, string> = {};
  const addOnsList: { name: string; priceDelta: number }[] = [];
  let itemBase = 0;
  if (item) {
    itemBase = item.price;
    for (const g of item.optionGroups ?? []) {
      const chosen = g.options.find((o) => allLower.includes(o.name.toLowerCase()));
      if (g.required && !chosen) {
        const list = g.options.map((o) => o.name).join(", ");
        return { reply: g.prompt ?? `What ${g.name}? (${list})` };
      }
      if (chosen) options[g.name] = chosen.name;
    }
    for (const a of item.addOns ?? []) if (allLower.includes(a.name.toLowerCase())) addOnsList.push(a);
  }

  // Quantity.
  let quantity = 1;
  if (flow.quantity?.required) {
    const q = parseNumber(allLower);
    if (!q) return { reply: flow.quantity.prompt };
    quantity = q;
  }

  // Fields.
  const fields: Record<string, string> = {};
  for (const f of flow.fields) {
    const v = extractField(f, messages, allUser);
    if (f.required && !v) return { reply: f.prompt };
    if (v) fields[f.name] = v;
  }

  // Pricing.
  const optionDelta = Object.entries(options).reduce((sum, [gName, oName]) => {
    const opt = item?.optionGroups?.find((g) => g.name === gName)?.options.find((o) => o.name === oName);
    return sum + (opt?.priceDelta ?? 0);
  }, 0);
  const addOnDelta = addOnsList.reduce((sum, a) => sum + a.priceDelta, 0);
  const unitPrice = itemBase + optionDelta + addOnDelta;
  const lineTotal = unitPrice * quantity;
  const total = item ? lineTotal : 0;

  const items = item
    ? [{ name: item.name, options, addOns: addOnsList.map((a) => a.name), quantity, unitPrice, lineTotal }]
    : [];

  const optText = Object.values(options).join(", ");
  const addText = addOnsList.map((a) => a.name).join(", ");
  const summary = item
    ? `${quantity}× ${item.name}${optText ? ` (${optText})` : ""}${addText ? ` + ${addText}` : ""} — ${formatMoney(lineTotal, config.currency)}`
    : "";

  const reply = render(flow.completionReply, {
    business: config.name,
    item: item?.name ?? "",
    summary,
    total: formatMoney(total, config.currency),
    currency: config.currency,
    ...fields,
  });

  return {
    reply,
    result: {
      status: "completed",
      action: flow.action,
      payload: { action: flow.action, items, fields, total, currency: config.currency },
    },
  };
}
