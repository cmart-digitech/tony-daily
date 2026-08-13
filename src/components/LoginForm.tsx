"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        const from = params.get("from");
        // Only follow same-site paths; anything else goes home.
        router.push(from && from.startsWith("/") && !from.startsWith("//") ? from : "/");
        router.refresh();
      } else {
        setError(data.error ?? "Sign-in failed.");
      }
    } catch {
      setError("Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password · 密碼"
        className="w-full border border-line-2 bg-elevated px-4 py-3 text-center text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !password}
        className="mt-3 w-full bg-ink px-4 py-3 text-sm text-bg transition-opacity hover:opacity-85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "…" : "Enter · 進入"}
      </button>
      <p aria-live="polite" className="mt-3 h-5 text-center text-sm text-down">
        {error ?? ""}
      </p>
    </form>
  );
}
