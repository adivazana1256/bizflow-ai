import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { businesses, customers, orders, orderItems, leads, repairBookings } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { businessConfig } from "@/config";
import {
  approveOrder,
  rejectOrder,
  approveRepair,
  rejectRepair,
  markLeadContacted,
  closeLead,
} from "./actions";

export default async function PanelPage() {
  const session = await auth();
  const businessId = session!.user.businessId;

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  // Pending orders + their items.
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

  const pendingRepairs = await db
    .select()
    .from(repairBookings)
    .where(and(eq(repairBookings.businessId, businessId), eq(repairBookings.status, "pending")))
    .orderBy(desc(repairBookings.createdAt));

  const newLeads = await db
    .select()
    .from(leads)
    .where(and(eq(leads.businessId, businessId), eq(leads.status, "new")))
    .orderBy(desc(leads.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Approval Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          {businessConfig.name} · {business?.currency} · {session!.user.email} ({session!.user.role})
        </p>
      </div>

      {/* Orders */}
      <section>
        <h2 className="mb-3 font-medium">Pending orders ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending orders.</p>
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
                          {it.extras ? ` + ${it.extras}` : ""} — {formatMoney(it.lineTotal, order.currency)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm font-semibold">
                      Total: {formatMoney(order.total, order.currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <form action={approveOrder} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <select name="eta" className="rounded border border-gray-300 px-2 py-1 text-sm">
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">60 min</option>
                      </select>
                      <button className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">Approve</button>
                    </form>
                    <form action={rejectOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="rounded bg-red-600 px-3 py-1 text-sm text-white">Reject</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Repair bookings */}
      <section>
        <h2 className="mb-3 font-medium">Pending repair bookings ({pendingRepairs.length})</h2>
        {pendingRepairs.length === 0 ? (
          <p className="text-sm text-gray-400">No pending repair bookings.</p>
        ) : (
          <ul className="space-y-3">
            {pendingRepairs.map((r) => (
              <li key={r.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {r.service}
                      {r.device ? ` — ${r.device}` : ""} · {formatMoney(r.price, r.currency)}
                    </p>
                    {r.phone && <p className="text-sm text-gray-400">{r.phone}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <form action={approveRepair} className="flex items-center gap-2">
                      <input type="hidden" name="repairId" value={r.id} />
                      <select name="mode" className="rounded border border-gray-300 px-2 py-1 text-sm">
                        <option value="today">Bring today</option>
                        <option value="appointment">Appointment needed</option>
                      </select>
                      <button className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">Approve</button>
                    </form>
                    <form action={rejectRepair}>
                      <input type="hidden" name="repairId" value={r.id} />
                      <button className="rounded bg-red-600 px-3 py-1 text-sm text-white">Reject</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Leads */}
      <section>
        <h2 className="mb-3 font-medium">New leads ({newLeads.length})</h2>
        {newLeads.length === 0 ? (
          <p className="text-sm text-gray-400">No new leads.</p>
        ) : (
          <ul className="space-y-3">
            {newLeads.map((l) => (
              <li key={l.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {l.interest ? `Interested in ${l.interest}` : "Lead"}
                    </p>
                    {l.phone && <p className="text-sm text-gray-400">{l.phone}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={markLeadContacted}>
                      <input type="hidden" name="leadId" value={l.id} />
                      <button className="rounded border border-gray-300 px-3 py-1 text-sm">Mark contacted</button>
                    </form>
                    <form action={closeLead}>
                      <input type="hidden" name="leadId" value={l.id} />
                      <button className="rounded border border-gray-300 px-3 py-1 text-sm">Reject / close</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
