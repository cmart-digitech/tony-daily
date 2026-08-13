import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import SaveButton from "@/components/SaveButton";
import SummaryPanel from "@/components/SummaryPanel";
import VerificationBadge from "@/components/VerificationBadge";
import { isAiConfigured } from "@/lib/ai";
import { hkDateTime } from "@/lib/format";
import { aiLanguage, t } from "@/lib/i18n";
import { getArticle, getEntities, relatedArticles, savedArticleIds } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";
import { clusterMembers } from "@/lib/retrieval";
import { getSource } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  markets: { en: "Markets", zh: "市場" },
  property: { en: "Property", zh: "地產" },
  architecture: { en: "Architecture", zh: "建築" },
  infrastructure: { en: "Infrastructure", zh: "基建" },
  government: { en: "Government", zh: "政府" },
  general: { en: "News", zh: "新聞" },
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const article = await getArticle(id);
  if (!article) notFound();

  const source = getSource(article.sourceId);
  // These four are independent; run them concurrently so the page cost is
  // one round trip's latency rather than four.
  const [prefs, allMembers, entities, related, savedIds] = await Promise.all([
    getPreferences(),
    clusterMembers(article),
    getEntities(article.id),
    relatedArticles(article, 6),
    savedArticleIds(),
  ]);
  const lang = prefs.language;
  const zh = lang === "zh" ? "zh" : "en";
  const members = allMembers.filter((m) => m.id !== article.id);
  const saved = savedIds.has(article.id);
  const cat = CATEGORY_LABELS[article.category] ?? CATEGORY_LABELS.general;
  const isVisual = article.category === "architecture" || article.category === "property";

  const companies = entities.filter((e) => e.entityType === "company");
  const tickers = entities.filter((e) => e.entityType === "ticker");
  const locations = entities.filter((e) => e.entityType === "location");
  const departments = entities.filter((e) => e.entityType === "department");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {article.imageUrl && (
        <figure className={`mb-8 ${isVisual ? "-mx-4 sm:-mx-6" : ""}`}>
          <img
            src={article.imageUrl}
            alt={article.originalTitle}
            className={`w-full object-cover ${isVisual ? "max-h-[560px]" : "max-h-[420px]"}`}
          />
          {article.imageAttribution && (
            <figcaption className="mt-1.5 px-4 text-right text-[11px] text-ink-3 sm:px-6">
              {article.imageAttribution}
            </figcaption>
          )}
        </figure>
      )}

      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
        {zh === "zh" ? cat.zh : cat.en}
      </p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {article.originalTitle}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-5 text-sm text-ink-2">
        <span className="font-medium text-ink">{source?.name ?? article.sourceId}</span>
        {article.author && <span>· {article.author}</span>}
        {article.publishedAt && (
          <span>
            · {t(lang, "published")} {hkDateTime(article.publishedAt, zh)} HKT
          </span>
        )}
        <span className="text-ink-3">
          · {t(lang, "fetchedLabel")} {hkDateTime(article.fetchedAt, zh)}
        </span>
        <VerificationBadge status={article.verificationStatus} lang={lang} />
      </div>

      {article.excerpt && (
        <p className="mt-6 font-serif text-lg leading-relaxed text-ink-2">
          {article.excerpt}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={article.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm bg-ink px-4 py-1.5 text-sm text-bg transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t(lang, "openSource")} ↗
        </a>
        <SaveButton
          articleId={article.id}
          initialSaved={saved}
          labels={{ save: t(lang, "save"), unsave: t(lang, "unsave") }}
        />
        <Link
          href={`/chat?q=${encodeURIComponent(
            (lang === "zh" ? "同我講吓呢單新聞：" : "Tell me about this story: ") +
              article.originalTitle,
          )}`}
          className="rounded-sm border border-line-2 px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t(lang, "askAboutThis")}
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-3">
          {t(lang, "summarise", { bilingual: true })}
        </h2>
        <SummaryPanel
          articleId={article.id}
          language={aiLanguage(lang)}
          aiConfigured={isAiConfigured()}
          labels={{
            s30: t(lang, "min30sec"),
            m2: t(lang, "min2"),
            deep: t(lang, "deepDive"),
            aiLabel: t(lang, "aiSummaryLabel"),
            notConfigured: t(lang, "aiNotConfigured"),
          }}
        />
      </section>

      {(companies.length > 0 || tickers.length > 0 || locations.length > 0 || departments.length > 0) && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
            {t(lang, "relatedCompanies", { bilingual: true })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...companies, ...departments, ...locations].map((e) => (
              <Link
                key={`${e.entityType}-${e.entity}`}
                href={`/search?q=${encodeURIComponent(e.entity)}`}
                className="rounded-full border border-line-2 px-3 py-1 text-xs text-ink-2 hover:border-accent hover:text-accent"
              >
                {e.entity}
              </Link>
            ))}
            {tickers.map((e) => (
              <Link
                key={`ticker-${e.entity}`}
                href={`/watchlist/${encodeURIComponent(e.entity)}`}
                className="rounded-full border border-accent/50 px-3 py-1 font-mono text-xs text-accent hover:bg-accent hover:text-white"
              >
                {e.entity}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
          {t(lang, "sources", { bilingual: true })}
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href={article.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-line-2 underline-offset-2 hover:text-accent"
            >
              {source?.name ?? article.sourceId} — {article.originalTitle}
            </a>
          </li>
          {members.map((m) => {
            const ms = getSource(m.sourceId);
            return (
              <li key={m.id}>
                <a
                  href={m.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-accent"
                >
                  {ms?.name ?? m.sourceId} — {m.originalTitle}
                </a>
              </li>
            );
          })}
        </ul>
        {members.length > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            {t(lang, "alsoReportedBy")}:{" "}
            {[...new Set(members.map((m) => getSource(m.sourceId)?.name ?? m.sourceId))].join(" · ")}
          </p>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-ink-3">
            {t(lang, "relatedStories", { bilingual: true })}
          </h2>
          <div className="space-y-6">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
