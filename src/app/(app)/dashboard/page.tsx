import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { businesses, customers, orders, orderItems } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { approveOrder, rejectOrder } from "./actions";

export default async function PanelPage() {
  const session = await auth();
  const businessId = session!.user.businessId;

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const pending = await db
    .select({ order: orders, customerName: customers.fullName })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.businessId, businessId), eq(orders.status, "pending")))
    .orderBy(desc(orders.createdAt));

  const ids = pending.map((p) => p.order.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          {business?.name} · {business?.currency} · {session!.user.email} ({session!.user.role})
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium">Pending orders ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">
            No pending orders. Complete an order in the Simulator to see it here.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map(({ order, customerName }) => (
              <li key={order.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{customerName ?? "Unknown"}</p>
                    <ul className="mt-1 text-sm text-gray-600">
                      {(itemsByOrder.get(order.id) ?? []).map((it) => (
                        <li key={it.id}>
                          {it.quantity}× {it.productName}
                          {it.variantName ? ` (${it.variantName})` : ""}
                          {it.extras ? ` + ${it.extras}` : ""} —{" "}
                          {formatMoney(it.lineTotal, order.currency)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm font-semibold">
                      Total: {formatMoney(order.total, order.currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={approveOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">
                        Approve
                      </button>
                    </form>
                    <form action={rejectOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="rounded bg-red-600 px-3 py-1 text-sm text-white">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Conversations", note: "Watch and take over — built with the AI engine." },
          { title: "Leads & quotes", note: "Follow-ups — built in the lead flow." },
        ].map((c) => (
          <div key={c.title} className="rounded border border-gray-200 bg-white p-4">
            <h2 className="font-medium">{c.title}</h2>
            <p className="mt-1 text-sm text-gray-400">{c.note}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
