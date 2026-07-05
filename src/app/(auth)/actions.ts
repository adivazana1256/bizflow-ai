"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type FormState = { error?: string } | null;

// Staff-only login. There is no public signup — staff are seeded by the
// developer via scripts/seed.ts.
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
