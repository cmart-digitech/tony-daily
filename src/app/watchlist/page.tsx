import ArticleCard from "@/components/ArticleCard";
import WatchlistBoard from "@/components/WatchlistBoard";
import { t } from "@/lib/i18n";
import { isMarketDataConfigured } from "@/lib/market";
import { watchlistNews } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;
  const news = await watchlistNews(8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "watchlist", { bilingual: true })}
      </h1>
      <WatchlistBoard
        marketConfigured={isMarketDataConfigured()}
        labels={{
          searchTicker: t(lang, "searchTicker"),
          addStock: t(lang, "addStock"),
          remove: t(lang, "remove"),
          favourite: t(lang, "favourite"),
          empty: t(lang, "emptyWatchlist"),
          notConfigured: t(lang, "marketDataNotConfigured"),
          unavailable: t(lang, "marketDataUnavailable"),
          delayed: t(lang, "delayed"),
          updated: t(lang, "updated"),
          disclaimer: t(lang, "disclaimer"),
        }}
      />
      {news.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
            {t(lang, "companyNews", { bilingual: true })}
          </h2>
          <div className="max-w-3xl space-y-6">
            {news.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
