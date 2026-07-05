import { businessConfig } from "../config";
import { runFlowEngine } from "../flow/engine";
import type { ChatMessage, EngineReply } from "../flow/types";

export type { ChatMessage, EngineReply };

// Entry point for a chat turn. Runs the config-driven flow engine. When Claude
// is not configured (no ANTHROPIC_API_KEY) this deterministic engine is the
// whole show; the real Claude tool-loop will drive the same flows later.
export async function respond(messages: ChatMessage[]): Promise<EngineReply & { mock: boolean }> {
  const claudeConfigured = !!process.env.ANTHROPIC_API_KEY;
  const reply = runFlowEngine(messages, businessConfig);
  return { ...reply, mock: !claudeConfigured };
}
