import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { orders, repairBookings, leads } from "../db/schema";
import { getHistory } from "../server/conversations";
import type { Tool, ToolContext } from "./types";

const inputSchema = z
  .object({ externalId: z.string().optional(), phone: z.string().optional() })
  .refine((v) => !!(v.externalId || v.phone), { message: "externalId or phone is required" });
type Input = z.infer<typeof inputSchema>;

// Read-only lookup across a customer's orders, repairs, and leads for this
// business, plus the conversation transcript when one is in context
// (src/server/conversations.ts getHistory). No writes.
export const getCustomerHistoryTool: Tool<Input> = {
  name: "get_customer_history",
  description: "Look up a customer's recent orders, repairs, leads, and conversation history.",
  category: "customers",
  inputSchema,
  async execute(input, ctx: ToolContext) {
    const { businessId } = ctx;
    const { externalId, phone } = input;

    const orderMatch = externalId ? eq(orders.customerExternalId, externalId) : undefined;
    const repairMatch = [
      externalId ? eq(repairBookings.customerExternalId, externalId) : undefined,
      phone ? eq(repairBookings.phone, phone) : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);
    const leadMatch = phone ? eq(leads.phone, phone) : undefined;

    const [recentOrders, recentRepairs, recentLeads, conversationHistory] = await Promise.all([
      orderMatch
        ? db.select().from(orders).where(and(eq(orders.businessId, businessId), orderMatch)).orderBy(desc(orders.createdAt)).limit(10)
        : Promise.resolve([]),
      repairMatch.length
        ? db
            .select()
            .from(repairBookings)
            .where(and(eq(repairBookings.businessId, businessId), or(...repairMatch)))
            .orderBy(desc(repairBookings.createdAt))
            .limit(10)
        : Promise.resolve([]),
      leadMatch
        ? db.select().from(leads).where(and(eq(leads.businessId, businessId), leadMatch)).orderBy(desc(leads.createdAt)).limit(10)
        : Promise.resolve([]),
      ctx.conversationId ? getHistory(ctx.conversationId) : Promise.resolve([]),
    ]);

    return { orders: recentOrders, repairs: recentRepairs, leads: recentLeads, conversationHistory };
  },
};
