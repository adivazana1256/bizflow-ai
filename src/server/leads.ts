import { db } from "../db/client";
import { leads } from "../db/schema";
import type { FlowPayload } from "../flow/types";

// Action handler for "create_lead". Persists a captured lead. Dedup by contact +
// interest so a repeated identical result inserts once.
export async function saveLead(businessId: string, payload: FlowPayload) {
  const f = payload.fields;
  const name = f.name ?? "Unknown";
  const key = JSON.stringify({ name, phone: f.phone ?? "", interest: f.interest ?? "" });

  const [row] = await db
    .insert(leads)
    .values({
      businessId,
      name,
      phone: f.phone ?? null,
      interest: f.interest ?? null,
      sourceKey: key,
    })
    .onConflictDoNothing({ target: [leads.businessId, leads.sourceKey] })
    .returning();

  return { saved: !!row };
}
