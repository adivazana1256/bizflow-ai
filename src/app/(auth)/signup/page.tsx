"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type FormState } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Create your business</h1>
      <form action={action} className="space-y-4">
        <input
          name="businessName"
          required
          placeholder="Business name"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          name="currency"
          required
          maxLength={3}
          placeholder="Currency (e.g. USD)"
          defaultValue="USD"
          className="w-full rounded border border-gray-300 px-3 py-2 uppercase"
        />
        <input
          name="fullName"
          required
          placeholder="Your name"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
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
          minLength={8}
          placeholder="Password (min 8 chars)"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {pending ? "…" : "Create business"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
