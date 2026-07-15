import { zodToJsonSchema } from "zod-to-json-schema";
import { toolRegistry } from "../tools";
import type { Tool, ToolContext } from "../tools";

// Bridges the existing Tool Registry (src/tools/**) to Claude's tool-use
// wire format. This is the ONLY new capability surface for the Claude loop —
// it adapts the registry, it does not add tools or business logic.

export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; [k: string]: unknown };
}

export function toClaudeTools(tools: Tool<any>[]): ClaudeToolDef[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: zodToJsonSchema(tool.inputSchema) as ClaudeToolDef["input_schema"],
  }));
}

/** Runs one tool call. Never throws — Claude gets an { error } result instead
 *  so it can recover (e.g. re-ask for missing fields) rather than the turn dying. */
export async function executeToolCall(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
  const tool = toolRegistry.get(name);
  if (!tool) return { error: `unknown tool: ${name}` };

  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  try {
    return await tool.execute(parsed.data, ctx);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}