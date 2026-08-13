import ArticleCard from "@/components/ArticleCard";
import StockDetail from "@/components/StockDetail";
import { t } from "@/lib/i18n";
import { isMarketDataConfigured } from "@/lib/market";
import { getPreferences } from "@/lib/prefs";
import { searchArticles } from "@/lib/retrieval";
import { dedupeByCluster } from "@/lib/retrieval";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const prefs = await getPreferences();
  const lang = prefs.language;
  // Related news: retrieval by ticker symbol over indexed articles.
  const related = dedupeByCluster(await searchArticles(symbol, 8));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <StockDetail
        symbol={symbol}
        marketConfigured={isMarketDataConfigured()}
        labels={{
          unavailable: t(lang, "marketDataUnavailable"),
          notConfigured: t(lang, "marketDataNotConfigured"),
          updated: t(lang, "updated"),
          delayed: t(lang, "delayed"),
          endOfDay: t(lang, "endOfDay"),
        }}
      />
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
            {t(lang, "relatedStories", { bilingual: true })}
          </h2>
          <div className="max-w-3xl space-y-6">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
