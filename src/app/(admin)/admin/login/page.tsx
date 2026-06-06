"use client";
import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions";

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const next = useSearchParams().get("next") ?? "/admin";
  return (
    <form action={action} className="w-full max-w-sm">
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-lime">
        <span className="inline-block h-0.5 w-6 bg-lime" /> Admin
      </div>
      <h1 className="mb-1 font-display text-4xl text-ink">World Cup &apos;26</h1>
      <p className="mb-6 text-sm text-mut">Enter the admin password to manage the pool.</p>

      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        autoFocus
        placeholder="Password"
        className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink outline-none focus:border-lime"
      />
      {state?.error && <p className="mt-2 text-sm text-red">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-lime px-4 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
