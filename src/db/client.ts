import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// App connection. Connects as the RLS-subject role (bizflow_app). Every query
// through this client is filtered by Row-Level Security. Always reach it via
// withTenant() so the tenant session variable is set. (C2)
const client = postgres(process.env.DATABASE_URL!, { max: 10 });

export const db = drizzle(client, { schema });
