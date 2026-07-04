import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminDb } from "../db/admin";
import { accounts } from "../db/schema";
import { verifyPassword } from "./password";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Pre-tenant lookup: email -> account across all businesses. Admin
        // connection, bypasses RLS. Email is globally unique. (auth bootstrap)
        const [acct] = await adminDb
          .select()
          .from(accounts)
          .where(eq(accounts.email, email))
          .limit(1);
        if (!acct || !acct.active) return null;

        const ok = await verifyPassword(acct.passwordHash, password);
        if (!ok) return null;

        return {
          id: acct.id,
          email: acct.email,
          name: acct.fullName,
          businessId: acct.businessId,
          role: acct.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.accountId = user.id as string;
        token.businessId = (user as { businessId?: string }).businessId;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.user.accountId = token.accountId as string;
      session.user.businessId = token.businessId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
});
