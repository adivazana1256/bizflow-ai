import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { customers, orders, orderItems } from "../db/schema";

// Shape of the summary produced by the mock engine's create_order result.
export interface OrderSummary {
  items: {
    product: string;
    size: string | null;
    extras: string[];
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  customerName: string;
  total: number;
  currency: string;
}

// Deterministic dedup key: the same completed order (same customer + items +
// total) yields the same key, so repeated identical chat results insert once.
// ponytail: changing the order mid-chat makes a new key (new pending order);
// the superseded one stays until staff rejects it. Fine for the mock.
function sourceKey(s: OrderSummary): string {
  return JSON.stringify({
    c: s.customerName,
    t: s.total,
    i: s.items.map((i) => [i.product, i.size, i.extras, i.quantity]),
  });
}

// Persists a pending order (+ customer + items). No payment, no WhatsApp.
// Returns { saved: false } when the dedup key already exists.
export async function savePendingOrder(businessId: string, summary: OrderSummary) {
  const key = sourceKey(summary);

  return db.transaction(async (tx) => {
    let [cust] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.businessId, businessId), eq(customers.fullName, summary.customerName)))
      .limit(1);
    if (!cust) {
      [cust] = await tx
        .insert(customers)
        .values({ businessId, fullName: summary.customerName })
        .returning();
    }

    const [order] = await tx
      .insert(orders)
      .values({
        businessId,
        customerId: cust.id,
        total: summary.total,
        currency: summary.currency,
        status: "pending",
        sourceKey: key,
      })
      .onConflictDoNothing({ target: [orders.businessId, orders.sourceKey] })
      .returning();

    if (!order) return { saved: false as const }; // duplicate

    for (const it of summary.items) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        productName: it.product,
        variantName: it.size,
        extras: it.extras.join(", "),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      });
    }
    return { saved: true as const, orderId: order.id };
  });
}
