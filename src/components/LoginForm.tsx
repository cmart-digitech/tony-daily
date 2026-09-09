"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const OAUTH_ERRORS: Record<string, string> = {
  "not-authorised": "That Google account is not authorised for this dashboard.",
  state: "Sign-in expired — please try again.",
  exchange: "Google sign-in failed — please try again.",
  token: "Google sign-in failed — please try again.",
  unverified: "That Google account's email is not verified.",
  "not-configured": "Google Sign-In is not configured.",
};

export default function LoginForm({
  googleEnabled,
  passwordEnabled,
}: {
  googleEnabled: boolean;
  passwordEnabled: boolean;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const oauthError = params.get("error");

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
    <div className="w-full max-w-sm">
      {googleEnabled && (
        <a
          href="/api/auth/google"
          className="mb-4 flex w-full items-center justify-center gap-3 border border-line-2 bg-elevated px-4 py-3 text-sm text-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.4 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.4 6.9-17.7z" />
            <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
            <path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.6-5.8l-7.7-6c-2.1 1.5-4.9 2.3-7.9 2.3-6.3 0-11.6-3.9-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Sign in with Google
        </a>
      )}
      {googleEnabled && passwordEnabled && (
        <p className="mb-4 text-center text-[11px] uppercase tracking-widest text-ink-3">
          or
        </p>
      )}
      {passwordEnabled && (
        <form onSubmit={submit}>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoFocus={!googleEnabled}
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
        </form>
      )}
      <p aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-down">
        {error ?? (oauthError ? (OAUTH_ERRORS[oauthError] ?? "Sign-in failed.") : "")}
      </p>
    </div>
  );
}
