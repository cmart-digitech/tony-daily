import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import WatchlistMini from "@/components/WatchlistMini";
import { t } from "@/lib/i18n";
import { articlesByCategory, watchlist, watchlistNews } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;
  const marketNews = await articlesByCategory(["markets"], 18);
  const policyNews = await articlesByCategory(["government"], 8);
  const companyNews = await watchlistNews(8);
  const watchItems = await watchlist();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "markets", { bilingual: true })}
      </h1>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {companyNews.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
                {t(lang, "companyNews", { bilingual: true })}
              </h2>
              <div className="space-y-6">
                {companyNews.map((a) => (
                  <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
              {t(lang, "marketSnapshot", { bilingual: true })}
            </h2>
            {marketNews.length === 0 ? (
              <p className="py-8 text-sm text-ink-3">{t(lang, "noVerifiedStories")}</p>
            ) : (
              <div className="space-y-6">
                {marketNews.map((a) => (
                  <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-10">
          <section>
            <h2 className="mb-4 flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink">
                {t(lang, "yourWatchlist", { bilingual: true })}
              </span>
              <Link href="/watchlist" className="text-xs text-ink-3 hover:text-accent">
                →
              </Link>
            </h2>
            <WatchlistMini
              symbols={watchItems.map((w) => w.symbol)}
              labels={{
                unavailable: t(lang, "marketDataUnavailable"),
                notConfigured: t(lang, "marketDataNotConfigured"),
                empty: t(lang, "emptyWatchlist"),
                updated: t(lang, "updated"),
                delayed: t(lang, "delayed"),
              }}
            />
          </section>
          {policyNews.length > 0 && (
            <section>
              <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
                {t(lang, "economyPolicy", { bilingual: true })}
              </h2>
              <div>
                {policyNews.map((a) => (
                  <ArticleCard key={a.id} article={a} lang={lang} variant="compact" />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
