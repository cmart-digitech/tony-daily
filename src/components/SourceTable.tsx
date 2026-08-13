"use client";

import { useEffect, useState } from "react";

interface SourceRow {
  id: string;
  name: string;
  language: string;
  type: string;
  tier: string;
  authority: number;
  enabled: boolean;
  lastSyncAt: number | null;
  lastStatus: string | null;
  lastError: string | null;
  lastItemCount: number | null;
}

function ago(ts: number | null, now: number): string {
  if (!ts) return "never";
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Source admin panel: health, freshness and enable toggles per source. */
export default function SourceTable() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Snapshot of "now" taken when data loads, so rendering stays pure.
  const [loadedAt, setLoadedAt] = useState(0);

  const load = async () => {
    const res = await fetch("/api/sources");
    const data = await res.json();
    if (data.ok) setSources(data.sources);
    setLoadedAt(Date.now());
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    setSources((s) => s.map((x) => (x.id === id ? { ...x, enabled } : x)));
    await fetch("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  };

  const health = (s: SourceRow) => {
    if (!s.enabled) return { dot: "bg-ink-3", label: "Disabled" };
    if (!s.lastSyncAt) return { dot: "bg-ink-3", label: "Not yet synced" };
    if (s.lastStatus === "error") return { dot: "bg-down", label: "Error" };
    const stale = loadedAt - s.lastSyncAt > 2 * 60 * 60 * 1000;
    if (stale) return { dot: "bg-accent", label: "Stale" };
    return { dot: "bg-up", label: "Healthy" };
  };

  if (!loaded) {
    return <div className="skeleton h-40 w-full rounded" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-[10px] uppercase tracking-widest text-ink-3">
            <th className="py-2 pr-4 font-medium">Source</th>
            <th className="py-2 pr-4 font-medium">Lang</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Tier</th>
            <th className="py-2 pr-4 font-medium">Last sync</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Enabled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sources.map((s) => {
            const h = health(s);
            return (
              <tr key={s.id}>
                <td className="py-2.5 pr-4 text-ink">{s.name}</td>
                <td className="py-2.5 pr-4 text-ink-2">
                  {s.language === "zh-HK" ? "繁" : "EN"}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-ink-2">{s.type}</td>
                <td className="py-2.5 pr-4 text-ink-2">{s.tier}</td>
                <td className="py-2.5 pr-4 text-ink-2">{ago(s.lastSyncAt, loadedAt)}</td>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${h.dot}`} />
                    {h.label}
                  </span>
                  {s.lastStatus === "error" && s.lastError && (
                    <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-ink-3" title={s.lastError}>
                      {s.lastError}
                    </p>
                  )}
                </td>
                <td className="py-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.enabled}
                    aria-label={`${s.name} enabled`}
                    onClick={() => toggle(s.id, !s.enabled)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      s.enabled ? "bg-up" : "bg-line-2"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        s.enabled ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
