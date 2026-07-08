import "./env";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { businesses, accounts } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import { businessConfig } from "../src/config";
import { DEV_BUSINESS_ID } from "../src/lib/constants";

// Seeds the single business + staff logins from the active config. Replaces the
// removed public signup. Idempotent: skips rows that already exist.
// ponytail: catalog/knowledge seeding is added once those tables exist (later phase).

async function main() {
  const cfg = businessConfig;

  let [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, DEV_BUSINESS_ID))
    .limit(1);
  if (!biz) {
    [biz] = await db
      .insert(businesses)
      .values({
        id: DEV_BUSINESS_ID,
        name: cfg.name,
        businessType: cfg.businessType,
        currency: cfg.currency,
        timezone: cfg.timezone,
      })
      .returning();
    console.log(`created business: ${biz.name}`);
  } else {
    console.log(`business exists: ${biz.name} (skipping create)`);
  }

  for (const s of cfg.staff) {
    const passwordHash = await hashPassword(s.password);
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, s.email))
      .limit(1);
    if (existing) {
      // Refresh to match config so re-running seed always yields working creds.
      await db
        .update(accounts)
        .set({ passwordHash, role: s.role, fullName: s.fullName, active: true })
        .where(eq(accounts.id, existing.id));
      console.log(`updated staff: ${s.email} (${s.role})`);
    } else {
      await db.insert(accounts).values({
        businessId: biz.id,
        fullName: s.fullName,
        email: s.email,
        passwordHash,
        role: s.role,
      });
      console.log(`created staff: ${s.email} (${s.role})`);
    }
  }

  console.log("\n✓ seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
