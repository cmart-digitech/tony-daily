"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshBriefButton({
  labels,
}: {
  labels: { refresh: string; refreshing: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1) pull fresh feeds (per-source cooldowns apply) then 2) rebuild brief
      await fetch("/api/ingest", { method: "POST" });
      const res = await fetch("/api/brief", { method: "POST" });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Refresh failed.");
      router.refresh();
    } catch {
      setError("Refresh failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="rounded-sm border border-line-2 px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? labels.refreshing : labels.refresh}
      </button>
      {error && <span className="text-xs text-down">{error}</span>}
    </span>
  );
}
