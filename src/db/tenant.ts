import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "./client";

// The single choke point for tenant-scoped DB access. Opens a transaction and
// sets app.business_id (local to the tx) before running fn. RLS policies filter
// every table on current_setting('app.business_id'). No query should touch a
// tenant table outside this wrapper. (C2)
//
// ponytail: transaction-per-call is fine for MVP volume; batch within one fn if
// a request needs several queries under the same tenant.
export async function withTenant<T>(
  businessId: string,
  fn: (tx: PgTransaction<any, any, any>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(key, value, is_local=true) === SET LOCAL, but parameterizable.
    await tx.execute(sql`select set_config('app.business_id', ${businessId}, true)`);
    return fn(tx as PgTransaction<any, any, any>);
  });
}
