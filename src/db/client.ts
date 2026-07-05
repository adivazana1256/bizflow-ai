import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Single DB connection. One business per deployment, so there is no RLS and no
// admin/app role split — the deployment is the isolation boundary. All queries
// go through this client.
const client = postgres(process.env.DATABASE_URL!, { max: 10 });

export const db = drizzle(client, { schema });
