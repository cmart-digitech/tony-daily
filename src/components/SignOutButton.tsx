"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sign out (brief §67). Without this the session cookie lasts 30 days with
 * no way to end it from the interface — the logout endpoint existed but
 * nothing ever called it.
 */
export default function SignOutButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="border border-line-2 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-down hover:text-down disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {busy ? "…" : label}
    </button>
  );
}
