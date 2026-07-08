import { db } from "../db/client";
import { leads } from "../db/schema";
import type { FlowPayload } from "../flow/types";

// Action handler for "create_lead". Persists a captured lead. `idempotencyKey`
// (the inbound provider message id) identifies one submission, so two leads
// with identical details never collide, while a re-delivered webhook dedups.
export async function saveLead(businessId: string, payload: FlowPayload, idempotencyKey: string) {
  const f = payload.fields;
  const name = f.name ?? "Unknown";
  const key = idempotencyKey;

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
