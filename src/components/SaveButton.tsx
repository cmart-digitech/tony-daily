"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SaveButton({
  articleId,
  initialSaved,
  labels,
}: {
  articleId: number;
  initialSaved: boolean;
  labels: { save: string; unsave: string };
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await fetch(`/api/saved?articleId=${articleId}`, { method: "DELETE" });
        setSaved(false);
      } else {
        await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId }),
        });
        setSaved(true);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={`rounded-sm border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
        saved
          ? "border-accent bg-accent text-white"
          : "border-line-2 text-ink-2 hover:border-accent hover:text-accent"
      }`}
    >
      {saved ? labels.unsave : labels.save}
    </button>
  );
}
