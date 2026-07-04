import type { Config } from "drizzle-kit";

// Used by drizzle-kit for future schema generation. Runtime migrations for
// Phase 1 are applied by scripts/migrate.ts (which also sets up roles + RLS).
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.ADMIN_DATABASE_URL ?? "",
  },
} satisfies Config;
