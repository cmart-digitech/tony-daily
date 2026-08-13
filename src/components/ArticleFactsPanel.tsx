"use client";

import { useEffect, useState } from "react";

interface Facts {
  project: string | null;
  location: string | null;
  developer: string | null;
  architect: string | null;
  landUse: string | null;
  status: string | null;
  keyFacts: string | null; // JSON string[]
}

/**
 * Typed metadata block for property/architecture stories (brief §57–58).
 * Fetches after the page renders so first view is never blocked by the
 * extraction call; shows only fields the source text states explicitly,
 * and renders nothing at all when there is nothing verified to show.
 */
export default function ArticleFactsPanel({
  articleId,
  labels,
}: {
  articleId: number;
  labels: {
    heading: string;
    keyFacts: string;
    aiLabel: string;
    project: string;
    location: string;
    developer: string;
    architect: string;
    landUse: string;
    status: string;
  };
}) {
  const [facts, setFacts] = useState<Facts | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setFacts(d.ok ? (d.facts ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) setFacts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (facts === undefined) return null; // loading — no skeleton flash for an optional block
  if (facts === null) return null;

  const fields: [string, string | null][] = [
    [labels.project, facts.project],
    [labels.location, facts.location],
    [labels.developer, facts.developer],
    [labels.architect, facts.architect],
    [labels.landUse, facts.landUse],
    [labels.status, facts.status],
  ];
  const present = fields.filter(([, v]) => v);
  let keyFacts: string[] = [];
  try {
    keyFacts = facts.keyFacts ? (JSON.parse(facts.keyFacts) as string[]) : [];
  } catch {
    keyFacts = [];
  }
  if (present.length === 0 && keyFacts.length === 0) return null;

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-3">
        {labels.heading}
      </h2>
      {present.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {present.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wider text-ink-3">{label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {keyFacts.length > 0 && (
        <div className={present.length > 0 ? "mt-6" : ""}>
          <h3 className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">
            {labels.keyFacts} · {labels.aiLabel}
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2 marker:text-ink-3">
            {keyFacts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
