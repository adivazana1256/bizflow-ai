import { db } from "../db/client";
import { repairBookings } from "../db/schema";
import type { FlowPayload } from "../flow/types";

// Action handler for "book_repair". Persists a pending repair booking awaiting
// staff confirmation. `idempotencyKey` (the inbound provider message id)
// identifies one submission, so two bookings with identical details never
// collide, while a re-delivered webhook dedups.
// `source` records where the booking came from (channel + the customer's id
// on that channel), so an approval/rejection reply knows where to send it.
export async function saveRepairBooking(
  businessId: string,
  payload: FlowPayload,
  idempotencyKey: string,
  source: { channel: string; externalId: string },
) {
  const f = payload.fields;
  const service = payload.items[0]?.name ?? "Repair";
  const name = f.name ?? "Unknown";
  const key = idempotencyKey;

  const [row] = await db
    .insert(repairBookings)
    .values({
      businessId,
      service,
      device: f.device ?? null,
      name,
      phone: f.phone ?? null,
      price: payload.total,
      currency: payload.currency,
      status: "pending",
      sourceKey: key,
      channel: source.channel,
      customerExternalId: source.externalId,
    })
    .onConflictDoNothing({ target: [repairBookings.businessId, repairBookings.sourceKey] })
    .returning();

  return { saved: !!row };
}
