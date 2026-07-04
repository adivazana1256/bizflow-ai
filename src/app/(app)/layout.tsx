import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <span className="font-semibold">BizFlow AI</span>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
