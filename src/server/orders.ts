import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { customers, orders, orderItems } from "../db/schema";
import type { FlowPayload } from "../flow/types";

export type { FlowPayload };

// Deterministic dedup key: the same completed order yields the same key, so a
// repeated identical chat result inserts once.
// ponytail: changing the order mid-chat makes a new key (new pending order); the
// superseded one stays until staff rejects it. Fine for the current engine.
function sourceKey(p: FlowPayload): string {
  const who = p.fields.name ?? Object.values(p.fields)[0] ?? "";
  return JSON.stringify({
    c: who,
    t: p.total,
    i: p.items.map((i) => [i.name, i.options, i.addOns, i.quantity]),
  });
}

// Action handler for the "create_order" action. Knows the order payload shape;
// the flow engine does not. Persists a pending order (+ customer + items).
// Returns { saved: false } when the dedup key already exists.
export async function savePendingOrder(businessId: string, payload: FlowPayload) {
  const key = sourceKey(payload);
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
        sourceKey: key,
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
