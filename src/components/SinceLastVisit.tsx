import Link from "next/link";
import type { ArticleRow } from "@/lib/retrieval";

/**
 * SINCE YOUR LAST VISIT (brief §54). Counts come from the ranked pool and
 * the tracked previous visit time — importance is decided by the existing
 * ranking system, never asserted. Renders nothing on a first visit or when
 * nothing new arrived.
 */
export default function SinceLastVisit({
  since,
  groups,
  zh,
}: {
  since: number;
  groups: { key: string; en: string; zhL: string; articles: ArticleRow[] }[];
  zh: boolean;
}) {
  const total = groups.reduce((n, g) => n + g.articles.length, 0);
  if (total === 0) return null;

  const sinceLabel = new Intl.DateTimeFormat(zh ? "zh-HK" : "en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(since));

  return (
    <section className="mb-10 border border-line bg-elevated px-5 py-4">
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-xs font-semibold uppercase tracking-widest text-ink">
        {zh ? "自你上次到訪" : "Since your last visit"}
        <span className="font-normal normal-case tracking-normal text-ink-3">
          {sinceLabel} HKT
        </span>
      </h2>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {groups
          .filter((g) => g.articles.length > 0)
          .map((g) => (
            <li key={g.key} className="text-sm">
              <span className="font-semibold text-ink">
                {g.articles.length} {zh ? g.zhL : g.en}
              </span>
              <span className="block truncate text-ink-2">
                <Link
                  href={`/article/${g.articles[0].id}`}
                  className="hover:text-accent"
                >
                  {g.articles[0].originalTitle}
                </Link>
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}
