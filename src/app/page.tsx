import { redirect } from "next/navigation";

export default function Home() {
  // (app)/dashboard guards itself and bounces to /login when unauthenticated.
  redirect("/dashboard");
}
