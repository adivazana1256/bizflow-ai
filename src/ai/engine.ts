import { businessConfig } from "../config";
import { runMockEngine, type ChatMessage, type EngineReply } from "./mock-engine";

export type { ChatMessage, EngineReply };

// Entry point for a chat turn. Loads the active BusinessConfig and produces a
// reply. When Claude is not configured (no ANTHROPIC_API_KEY) it uses the
// deterministic mock. The real Claude tool-use loop lands with the AI engine
// phase; until then this always mocks and flags it.
export async function respond(messages: ChatMessage[]): Promise<EngineReply & { mock: boolean }> {
  const claudeConfigured = !!process.env.ANTHROPIC_API_KEY;
  // ponytail: real engine not built yet — mock regardless, but report honestly.
  const reply = runMockEngine(messages, businessConfig);
  return { ...reply, mock: !claudeConfigured };
}
