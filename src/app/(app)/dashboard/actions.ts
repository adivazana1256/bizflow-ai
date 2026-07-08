"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { orders, repairBookings, leads } from "@/db/schema";
import { WhatsAppTransport } from "@/transport/whatsapp";
import {
  orderApprovedText,
  orderRejectedText,
  repairApprovedText,
  repairRejectedText,
  shouldSendReply,
} from "./replies";

// Notifies the customer of an approval/reject result. Only WhatsApp-sourced
// items carry a channel + external id — simulator items (and any rows from
// before this migration) are skipped, never failed. A fresh transport instance
// has no stashed conversationId, so this only sends; it doesn't log the
// message into the conversation history (out of scope here).
async function sendCustomerReply(channel: string | null, to: string | null, text: string) {
  if (!to || !shouldSendReply(channel, to)) return;
  try {
    await new WhatsAppTransport().sendMessage({ channel: "whatsapp", to, text });
  } catch (e) {
    console.error("sendCustomerReply failed:", e);
  }
}

async function setOrderStatus(orderId: string, status: "approved" | "rejected", text: string) {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  const [row] = await db
    .update(orders)
    .set({ status })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId), eq(orders.status, "pending")))
    .returning({ channel: orders.channel, customerExternalId: orders.customerExternalId });
  revalidatePath("/dashboard");
  if (row) await sendCustomerReply(row.channel, row.customerExternalId, text);
}

export async function approveOrder(formData: FormData) {
  await setOrderStatus(
    String(formData.get("orderId")),
    "approved",
    orderApprovedText(String(formData.get("eta"))),
  );
}
export async function rejectOrder(formData: FormData) {
  await setOrderStatus(String(formData.get("orderId")), "rejected", orderRejectedText);
}

async function setRepairStatus(repairId: string, status: "approved" | "rejected", text: string) {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  const [row] = await db
    .update(repairBookings)
    .set({ status })
    .where(
      and(
        eq(repairBookings.id, repairId),
        eq(repairBookings.businessId, businessId),
        eq(repairBookings.status, "pending"),
      ),
    )
    .returning({ channel: repairBookings.channel, customerExternalId: repairBookings.customerExternalId });
  revalidatePath("/dashboard");
  if (row) await sendCustomerReply(row.channel, row.customerExternalId, text);
}

export async function approveRepair(formData: FormData) {
  await setRepairStatus(
    String(formData.get("repairId")),
    "approved",
    repairApprovedText(String(formData.get("mode"))),
  );
}
export async function rejectRepair(formData: FormData) {
  await setRepairStatus(String(formData.get("repairId")), "rejected", repairRejectedText);
}

export async function markLeadContacted(formData: FormData) {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  await db
    .update(leads)
    .set({ status: "contacted" })
    .where(
      and(
        eq(leads.id, String(formData.get("leadId"))),
        eq(leads.businessId, businessId),
        eq(leads.status, "new"),
      ),
    );
  revalidatePath("/dashboard");
}

export async function closeLead(formData: FormData) {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  await db
    .update(leads)
    .set({ status: "closed" })
    .where(
      and(
        eq(leads.id, String(formData.get("leadId"))),
        eq(leads.businessId, businessId),
        eq(leads.status, "new"),
      ),
    );
  revalidatePath("/dashboard");
}
