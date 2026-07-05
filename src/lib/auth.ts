import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
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

        // ⚠️ DEV ONLY — hardcoded login bypass to unblock local development.
        // Never active in production (guarded by NODE_ENV). Remove before deploy.
        if (
          process.env.NODE_ENV !== "production" &&
          email === "owner@tonys.local" &&
          password === "changeme123"
        ) {
          return {
            id: "dev-owner",
            email: "owner@tonys.local",
            name: "Owner",
            businessId: "00000000-0000-0000-0000-000000000001",
            role: "owner",
          };
        }
        // ⚠️ END DEV ONLY

        // Staff login: look up the account by email (globally unique).
        const [acct] = await db
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
