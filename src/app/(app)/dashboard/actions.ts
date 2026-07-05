"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { orders } from "@/db/schema";

async function setStatus(orderId: string, status: "approved" | "rejected") {
  const session = await auth();
  const businessId = session?.user.businessId;
  if (!businessId) return;
  // Scope the update to this business and only decide pending orders.
  await db
    .update(orders)
    .set({ status })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId), eq(orders.status, "pending")));
  revalidatePath("/dashboard");
}

export async function approveOrder(formData: FormData) {
  await setStatus(String(formData.get("orderId")), "approved");
}

export async function rejectOrder(formData: FormData) {
  await setStatus(String(formData.get("orderId")), "rejected");
}
