import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { businessConfig } from "../config";
import { toolRegistry } from "../tools";
import type { ToolContext } from "../tools";
import type { ChatMessage, EngineReply } from "../flow/types";
import { toClaudeTools, executeToolCall } from "./tool-adapter";

const MAX_TOOL_ITERATIONS = 8;

const SAFETY_RULES = `
SAFETY RULES (must always follow):
- Only state prices, products, or availability that came from the search_products or search_knowledge tools. Never invent prices or products.
- Never approve orders or bookings yourself — you may only create them as pending, awaiting staff approval.
- Never perform refunds or payments; no tool exists for that on purpose.
- Call handover_to_human when you are uncertain, the request is a complaint, or the customer asks for a person.
- Before creating an order, lead, or booking, ask for any required information you don't already have.`;

function buildResponseRules(language: string): string {
  return `
RESPONSE STYLE (must always follow):
- You are a real customer-service employee of ${businessConfig.name} — warm, professional, concise, natural. You are NOT a generic AI assistant. Never use robotic system-speak like "לא הצלחתי למצוא במערכת" or similar phrases.
- Reply in ${language}, in every message, regardless of what language the customer writes in.
- Plain text only — no markdown (no **bold**, no #, no backticks). Emoji such as ✅ are fine.
- Be concise and service-oriented. Ask only for information you're still missing — never re-ask for details the customer already gave.
- Never invent prices, repair times, availability, or advice that didn't come from a tool or business knowledge. If a price is unavailable, reply with EXACTLY this line and nothing else:
אין לי כרגע מחיר מדויק. צוות המעבדה יחזור אליך עם מחיר וזמן טיפול.
- After successfully creating an order, repair booking, or lead, confirm using EXACTLY this shape (fill in the real values from the conversation; omit a line only if that field doesn't apply to this request):
הבקשה נרשמה בהצלחה ✅

סיכום:
שירות: <service>
מכשיר: <device>
שם: <name>
טלפון: <phone>

הצוות יחזור אליך עם מחיר וזמן טיפול.`;
}

function buildSystemPrompt(): string {
  const language = businessConfig.locale === "he" ? "Hebrew" : (businessConfig.persona.language ?? "the business's language");
  return `You are the AI employee for ${businessConfig.name}.\n\n${businessConfig.persona.systemPrompt}\n${buildResponseRules(language)}\n${SAFETY_RULES}`;
}

function toAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Claude-driven tool loop. The Tool Registry (src/tools/**) is the only
 * capability surface — tools already persist via ctx (create_order,
 * create_lead, book_repair call the existing server handlers), so this
 * function never touches the DB and never returns a `result` (that would
 * both double-save in processInbound and leak raw tool JSON to the
 * customer-facing UI). Only the natural-language `reply` text is returned.
 */
export async function respondWithClaude(
  messages: ChatMessage[],
  ctx: ToolContext,
): Promise<EngineReply & { mock: boolean }> {
  const client = new Anthropic();
  const model = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";
  const tools = toClaudeTools(toolRegistry.list());
  const system = buildSystemPrompt();

  const conversation: MessageParam[] = toAnthropicMessages(messages);
  let handedOver = false;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: conversation,
      tools,
    });

    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      // Never surface tool results to the customer — reply text only.
      // If handover produced no visible text, fall back to a natural line.
      return {
        reply: reply || (handedOver ? "אני מעביר אותך לנציג שירות שימשיך לטפל בפנייה שלך. תודה על הסבלנות." : reply),
        mock: false,
      };
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "handover_to_human") handedOver = true;
      const result = await executeToolCall(block.name, block.input, ctx);
      const isError = typeof result === "object" && result !== null && "error" in result;
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }
    conversation.push({ role: "user", content: toolResults });
  }

  return { reply: "I'm having trouble completing that — let me get a staff member to help.", mock: false };
}