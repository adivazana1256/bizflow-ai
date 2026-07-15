import { businessConfig } from "../config";
import { runFlowEngine } from "../flow/engine";
import type { ChatMessage, EngineReply } from "../flow/types";
import type { ToolContext } from "../tools";

export type { ChatMessage, EngineReply };

// Entry point for a chat turn. Uses the Claude tool loop (src/ai/claude-brain.ts)
// when ANTHROPIC_API_KEY is set and a ToolContext (businessId) is available;
// otherwise — and on any Claude-path error — falls back to the deterministic,
// config-driven flow engine so the app always works without a key.
export async function respond(messages: ChatMessage[], ctx?: ToolContext): Promise<EngineReply & { mock: boolean }> {
  if (process.env.ANTHROPIC_API_KEY && ctx?.businessId) {
    try {
      const { respondWithClaude } = await import("./claude-brain");
      return await respondWithClaude(messages, ctx);
    } catch (e) {
      console.error("Claude engine failed, falling back to deterministic engine:", e);
    }
  }
  const reply = runFlowEngine(messages, businessConfig);
  return { ...reply, mock: true };
}
