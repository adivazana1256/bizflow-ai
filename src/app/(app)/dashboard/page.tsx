import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { withTenant } from "@/db/tenant";
import { businesses } from "@/db/schema";

export default async function DashboardPage() {
  const session = await auth();
  const businessId = session!.user.businessId;

  // Read through the RLS-scoped app connection — proves the tenant path works.
  const [business] = await withTenant(businessId, (tx) =>
    tx.select().from(businesses).where(eq(businesses.id, businessId)),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome to <span className="font-medium">{business?.name}</span>.
      </p>
      <p className="mt-1 text-sm text-gray-400">
        Currency {business?.currency} · role {session!.user.role}
      </p>
    </div>
  );
}
