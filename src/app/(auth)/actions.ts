"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { AuthError } from "next-auth";
import { adminDb } from "@/db/admin";
import { businesses, accounts } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";

export type FormState = { error?: string } | null;

const signupSchema = z.object({
  businessName: z.string().min(1, "Business name required"),
  currency: z.string().length(3, "Use a 3-letter currency code"),
  fullName: z.string().min(1, "Your name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  // Signup is a pre-tenant bootstrap: create the business + owner via the admin
  // connection (RLS bypass), since no tenant context exists yet.
  const existing = await adminDb
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, d.email))
    .limit(1);
  if (existing.length) return { error: "Email already registered" };

  const passwordHash = await hashPassword(d.password);
  await adminDb.transaction(async (tx) => {
    const [biz] = await tx
      .insert(businesses)
      .values({ name: d.businessName, currency: d.currency.toUpperCase() })
      .returning();
    await tx.insert(accounts).values({
      businessId: biz.id,
      fullName: d.fullName,
      email: d.email,
      passwordHash,
      role: "owner",
    });
  });

  // signIn throws NEXT_REDIRECT on success — let it propagate.
  await signIn("credentials", {
    email: d.email,
    password: d.password,
    redirectTo: "/dashboard",
  });
  return null;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password" };
    throw error; // NEXT_REDIRECT and anything else
  }
}
