import { z } from "zod";
import type { Tool } from "./types";

const inputSchema = z.object({ reason: z.string().optional() });
type Input = z.infer<typeof inputSchema>;

// No persistence exists for handover today — the flow engine (src/flow/engine.ts)
// just returns { status: "handover" }. This tool mirrors that same signal so a
// future Claude loop can trigger the identical stop-and-flag-for-staff
// behavior. No side effects.
export const handoverToHumanTool: Tool<Input> = {
  name: "handover_to_human",
  description: "Stop AI replies and flag this conversation for a staff member to take over.",
  category: "support",
  inputSchema,
  async execute(input) {
    return { status: "handover" as const, reason: input.reason };
  },
};
