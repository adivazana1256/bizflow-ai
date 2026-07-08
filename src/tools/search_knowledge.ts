import { z } from "zod";
import { businessConfig } from "../config";
import type { Tool } from "./types";

const inputSchema = z.object({ query: z.string().min(1) });
type Input = z.infer<typeof inputSchema>;

// Thin keyword search over the seeded knowledge base (src/config/types.ts
// KnowledgeEntry) — same matching spirit as the flow engine's FAQ lookup
// (src/flow/engine.ts matchFaq), but returns all matches instead of the
// first one, since a future AI benefits from seeing the options.
export const searchKnowledgeTool: Tool<Input> = {
  name: "search_knowledge",
  description: "Search the business's FAQ/knowledge base by keyword and return matching entries.",
  category: "knowledge",
  inputSchema,
  async execute(input) {
    const tokens = (input.query.toLowerCase().match(/[a-z]+/g) ?? []).filter((t) => t.length >= 3);
    const knowledge = businessConfig.knowledge ?? [];
    return knowledge.filter((k) => {
      const keys = (`${k.title} ${k.category ?? ""}`.toLowerCase().match(/[a-z]+/g) ?? []).filter(
        (w) => w.length >= 4,
      );
      return keys.some((kw) => tokens.some((t) => kw.startsWith(t) || t.startsWith(kw)));
    });
  },
};
