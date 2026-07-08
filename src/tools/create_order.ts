import { randomUUID } from "node:crypto";
import { z } from "zod";
import { savePendingOrder } from "../server/orders";
import type { FlowPayload } from "../flow/types";
import type { Tool, ToolContext } from "./types";

const itemSchema = z.object({
  name: z.string().min(1),
  options: z.record(z.string()).default({}),
  addOns: z.array(z.string()).default([]),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(), // minor units
});

const inputSchema = z.object({
  items: z.array(itemSchema).min(1),
  fields: z.record(z.string()).default({}), // e.g. { name: "Jane" }
  currency: z.string().min(1),
});
type Input = z.infer<typeof inputSchema>;

// Thin wrapper over the "create_order" action handler (src/server/orders.ts
// savePendingOrder). Builds a FlowPayload (src/flow/types.ts) from validated
// input; all persistence — customer upsert, order + items insert, dedup by
// idempotency key — stays in savePendingOrder.
export const createOrderTool: Tool<Input> = {
  name: "create_order",
  description: "Create a pending order for the customer, awaiting staff approval.",
  category: "orders",
  inputSchema,
  async execute(input, ctx: ToolContext) {
    const items = input.items.map((it) => ({ ...it, lineTotal: it.unitPrice * it.quantity }));
    const total = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const payload: FlowPayload = { action: "create_order", items, fields: input.fields, total, currency: input.currency };
    return savePendingOrder(ctx.businessId, payload, ctx.idempotencyKey ?? randomUUID(), {
      channel: ctx.channel ?? "tool",
      externalId: ctx.externalId ?? "",
    });
  },
};
