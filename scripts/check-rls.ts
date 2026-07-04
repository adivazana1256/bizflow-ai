import "./env";
import { eq } from "drizzle-orm";
import { adminDb } from "../src/db/admin";
import { withTenant } from "../src/db/tenant";
import { businesses, accounts } from "../src/db/schema";

// Proves tenant isolation is enforced by the DATABASE (RLS), not app code.
// Seeds two businesses via the admin connection, then reads through the
// RLS-subject app connection under each tenant and asserts no cross-tenant leak.
async function main() {
  const suffix = Date.now();
  const [a] = await adminDb.insert(businesses).values({ name: "RLS-Test-A" }).returning();
  const [b] = await adminDb.insert(businesses).values({ name: "RLS-Test-B" }).returning();
  const [accA] = await adminDb
    .insert(accounts)
    .values({ businessId: a.id, fullName: "A", email: `a-${suffix}@t.local`, passwordHash: "x" })
    .returning();
  const [accB] = await adminDb
    .insert(accounts)
    .values({ businessId: b.id, fullName: "B", email: `b-${suffix}@t.local`, passwordHash: "x" })
    .returning();

  let ok = true;
  const check = (pass: boolean, msg: string) => {
    console.log(`${pass ? "PASS" : "FAIL"}: ${msg}`);
    if (!pass) ok = false;
  };

  // 1. Under tenant A, listing accounts returns only A's rows.
  const visibleA = await withTenant(a.id, (tx) => tx.select().from(accounts));
  check(
    visibleA.length > 0 && visibleA.every((r) => r.businessId === a.id),
    `tenant A sees only its own accounts (${visibleA.length} row(s), 0 foreign)`,
  );

  // 2. Under tenant A, reading B's account by id returns nothing.
  const leaked = await withTenant(a.id, (tx) =>
    tx.select().from(accounts).where(eq(accounts.id, accB.id)),
  );
  check(leaked.length === 0, "tenant A cannot read tenant B's account by id");

  // 3. Under tenant B, B can read its own account (isolation isn't just blanket deny).
  const visibleB = await withTenant(b.id, (tx) =>
    tx.select().from(accounts).where(eq(accounts.id, accB.id)),
  );
  check(visibleB.length === 1, "tenant B can read its own account");

  // Cleanup.
  await adminDb.delete(accounts).where(eq(accounts.id, accA.id));
  await adminDb.delete(accounts).where(eq(accounts.id, accB.id));
  await adminDb.delete(businesses).where(eq(businesses.id, a.id));
  await adminDb.delete(businesses).where(eq(businesses.id, b.id));

  console.log(`\nRLS CHECK: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
