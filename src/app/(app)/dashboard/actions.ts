"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { orders, repairBookings, leads } from "@/db/schema";

async function setOrderStatus(orderId: string, status: "approved" | "rejected") {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  await db
    .update(orders)
    .set({ status })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId), eq(orders.status, "pending")));
  revalidatePath("/dashboard");
}

export async function approveOrder(formData: FormData) {
  await setOrderStatus(String(formData.get("orderId")), "approved");
}
export async function rejectOrder(formData: FormData) {
  await setOrderStatus(String(formData.get("orderId")), "rejected");
}

async function setRepairStatus(repairId: string, status: "approved" | "rejected") {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  await db
    .update(repairBookings)
    .set({ status })
    .where(
      and(
        eq(repairBookings.id, repairId),
        eq(repairBookings.businessId, businessId),
        eq(repairBookings.status, "pending"),
      ),
    );
  revalidatePath("/dashboard");
}

export async function approveRepair(formData: FormData) {
  await setRepairStatus(String(formData.get("repairId")), "approved");
}
export async function rejectRepair(formData: FormData) {
  await setRepairStatus(String(formData.get("repairId")), "rejected");
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
