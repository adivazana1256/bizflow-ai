import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { customers, orders, orderItems } from "../db/schema";
import type { FlowPayload } from "../flow/types";

export type { FlowPayload };

// Action handler for the "create_order" action. Knows the order payload shape;
// the flow engine does not. Persists a pending order (+ customer + items).
// `idempotencyKey` (the inbound provider message id, or a fresh one when the
// channel has none) is the dedup key — it identifies one submission, not its
// content, so two different customers with identical order details never
// collide, while a re-delivered webhook (same key) still dedups.
// Returns { saved: false } when the dedup key already exists.
// `source` records where the order came from (channel + the customer's id on
// that channel), so an approval/rejection reply knows where to send it.
export async function savePendingOrder(
  businessId: string,
  payload: FlowPayload,
  idempotencyKey: string,
  source: { channel: string; externalId: string },
) {
  const customerName = payload.fields.name ?? Object.values(payload.fields)[0] ?? "Unknown";

  return db.transaction(async (tx) => {
    let [cust] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.businessId, businessId), eq(customers.fullName, customerName)))
      .limit(1);
    if (!cust) {
      [cust] = await tx.insert(customers).values({ businessId, fullName: customerName }).returning();
    }

    const [order] = await tx
      .insert(orders)
      .values({
        businessId,
        customerId: cust.id,
        total: payload.total,
        currency: payload.currency,
        status: "pending",
        sourceKey: idempotencyKey,
        channel: source.channel,
        customerExternalId: source.externalId,
      })
      .onConflictDoNothing({ target: [orders.businessId, orders.sourceKey] })
      .returning();

    if (!order) return { saved: false as const }; // duplicate

    for (const it of payload.items) {
      const optionText = Object.values(it.options).join(", ");
      await tx.insert(orderItems).values({
        orderId: order.id,
        productName: it.name,
        variantName: optionText || null,
        extras: it.addOns.join(", "),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      });
    }
    return { saved: true as const, orderId: order.id };
  });
}
