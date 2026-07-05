import type { Config } from "drizzle-kit";

// Used by drizzle-kit for future schema generation. Runtime migrations are
// applied by scripts/migrate.ts.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
