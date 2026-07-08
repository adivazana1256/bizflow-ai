import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveRepairBooking } from "../server/repairs";
import { businessConfig } from "../config";
import type { FlowPayload } from "../flow/types";
import type { Tool, ToolContext } from "./types";

const inputSchema = z.object({
  service: z.string().min(1),
  device: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  price: z.number().int().nonnegative().optional(), // minor units; 0/omitted when quote-only
});
type Input = z.infer<typeof inputSchema>;

// Thin wrapper over the "book_repair" action handler (src/server/repairs.ts saveRepairBooking).
export const bookRepairTool: Tool<Input> = {
  name: "book_repair",
  description: "Book a repair for the customer, awaiting staff confirmation.",
  category: "repairs",
  inputSchema,
  async execute(input, ctx: ToolContext) {
    const price = input.price ?? 0;
    const payload: FlowPayload = {
      action: "book_repair",
      items: [{ name: input.service, options: {}, addOns: [], quantity: 1, unitPrice: price, lineTotal: price }],
      fields: {
        name: input.name,
        ...(input.device ? { device: input.device } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      },
      total: price,
      currency: businessConfig.currency,
    };
    return saveRepairBooking(ctx.businessId, payload, ctx.idempotencyKey ?? randomUUID(), {
      channel: ctx.channel ?? "tool",
      externalId: ctx.externalId ?? "",
    });
  },
};
