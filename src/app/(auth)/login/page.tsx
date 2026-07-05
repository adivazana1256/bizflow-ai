"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Log in to BizFlow AI</h1>
      <form action={action} className="space-y-4">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {pending ? "…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
