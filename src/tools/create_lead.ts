import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveLead } from "../server/leads";
import { businessConfig } from "../config";
import type { FlowPayload } from "../flow/types";
import type { Tool, ToolContext } from "./types";

const inputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  interest: z.string().optional(),
});
type Input = z.infer<typeof inputSchema>;

// Thin wrapper over the "create_lead" action handler (src/server/leads.ts saveLead).
export const createLeadTool: Tool<Input> = {
  name: "create_lead",
  description: "Capture a lead (contact + interest) for staff follow-up.",
  category: "leads",
  inputSchema,
  async execute(input, ctx: ToolContext) {
    const payload: FlowPayload = {
      action: "create_lead",
      items: [],
      fields: {
        name: input.name,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.interest ? { interest: input.interest } : {}),
      },
      total: 0,
      currency: businessConfig.currency,
    };
    return saveLead(ctx.businessId, payload, ctx.idempotencyKey ?? randomUUID());
  },
};
