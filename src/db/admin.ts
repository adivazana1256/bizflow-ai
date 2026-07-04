import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Admin connection. Superuser role — BYPASSES RLS by design. Use ONLY for the
// two operations that are inherently pre-tenant: signup (creating a tenant) and
// login (resolving an email to its business). Never use for normal app queries.
const client = postgres(process.env.ADMIN_DATABASE_URL!, { max: 5 });

export const adminDb = drizzle(client, { schema });
