"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/status")
      .then((response) => response.json())
      .then((data: { authConfigured?: boolean }) => {
        setConfigured(Boolean(data.authConfigured));
      })
      .catch(() => setConfigured(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--paper)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-8 shadow-sm">
        <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Nels</p>
        <h1 className="mt-1 font-serif text-4xl">Sign in</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          One password protects this planner. After you sign in, notes, tasks, and events
          sync across every browser that uses this site.
        </p>
        {configured === false ? (
          <p className="mt-6 rounded-2xl bg-[#f6e8e4] px-4 py-3 text-sm text-[var(--danger)]">
            Set <code>NELS_PASSWORD</code> in <code>.env.local</code> (local) or in the Vercel
            project environment variables, then restart / redeploy.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block text-sm">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 outline-none focus:border-[var(--pine)] focus:ring-2 focus:ring-[var(--pine)]/20"
              />
            </label>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--paper)]" />}>
      <LoginForm />
    </Suspense>
  );
}
