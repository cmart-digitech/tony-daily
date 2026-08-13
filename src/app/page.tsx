import Link from "next/link";
import { redirect } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import FormattedText from "@/components/FormattedText";
import RefreshBriefButton from "@/components/RefreshBriefButton";
import WatchlistMini from "@/components/WatchlistMini";
import { generateDailyBrief, getTodaysBrief } from "@/lib/brief";
import { hkFullDate, timeAgo } from "@/lib/format";
import { greetingFor } from "@/lib/greeting";
import { t } from "@/lib/i18n";
import { imageFirst } from "@/lib/layout";
import { lastRefreshedAt } from "@/lib/ingest";
import { getArticles, topStories, watchlist } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";
import type { ArticleRow } from "@/lib/retrieval";

export const dynamic = "force-dynamic";

const SECTION_LABELS: Record<string, Parameters<typeof t>[1]> = {
  watchlist: "yourWatchlist",
  hk: "hongKong",
  property: "propertyDevelopment",
  architecture: "builtEnvironment",
  china: "greaterChinaAsia",
  global: "globalWatch",
};

export default async function TodayPage() {
  const prefs = await getPreferences();
  if (!prefs.onboarded) redirect("/onboarding");
  const lang = prefs.language;
  const zh = lang === "zh" ? "zh" : "en";
  // Greeting follows Hong Kong time, not the server's region.
  const greeting = greetingFor(lang);

  let brief = await getTodaysBrief();
  if (!brief) {
    // First view of the day: build the brief from already-indexed stories.
    try {
      await generateDailyBrief();
      brief = await getTodaysBrief();
    } catch {
      brief = null;
    }
  }

  // Independent of each other — issue them together rather than in series.
  const [refreshedAt, watchItems, ranked] = await Promise.all([
    lastRefreshedAt(),
    watchlist(),
    topStories(40),
  ]);

  // Every brief section resolves from the same cached pool, so this costs
  // one query in total rather than one per section.
  const sectionArticles = new Map<string, ArticleRow[]>();
  const usedIds = new Set<number>();
  if (brief) {
    const sections = await Promise.all(
      brief.content.sections.map(async (s) => [s.key, await getArticles(s.articleIds)] as const),
    );
    for (const [key, arts] of sections) {
      sectionArticles.set(key, arts);
      for (const a of arts) usedIds.add(a.id);
    }
  }

  // Hero: the strongest visual story of the brief, else the top story.
  const allBriefArticles = [...sectionArticles.values()]
    .flat()
    .sort((a, b) => b.score - a.score);
  const hero = allBriefArticles.find((a) => a.imageUrl) ?? allBriefArticles[0] ?? ranked[0];
  const more = ranked
    .filter((a) => !usedIds.has(a.id) && a.id !== hero?.id)
    .slice(0, 8);

  const hasContent = Boolean(hero) || usedIds.size > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Masthead */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
            {hkFullDate(zh)} · Hong Kong
          </p>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">{greeting.title}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {greeting.subtitle} — {t(lang, "hongKong")} · {t(lang, "markets")} ·{" "}
            {t(lang, "property")} · {t(lang, "architecture")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {refreshedAt && (
            <span className="text-xs text-ink-3">
              {t(lang, "newsRefreshed")} {timeAgo(refreshedAt, zh)}
            </span>
          )}
          <RefreshBriefButton
            labels={{ refresh: t(lang, "refreshBrief"), refreshing: t(lang, "refreshing") }}
          />
        </div>
      </div>

      {!hasContent && (
        <div className="border border-dashed border-line-2 px-6 py-20 text-center">
          <p className="mb-4 text-ink-2">{t(lang, "noVerifiedStories")}</p>
          <RefreshBriefButton
            labels={{ refresh: t(lang, "refreshBrief"), refreshing: t(lang, "refreshing") }}
          />
        </div>
      )}

      {hasContent && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Lead column */}
          <div className="lg:col-span-2">
            {hero && <ArticleCard article={hero} lang={lang} variant="hero" />}

            {brief?.content.overview && (
              <section className="mt-10 border-y border-line py-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
                  {t(lang, "overview", { bilingual: true })} — {t(lang, "aiSummaryLabel")}
                </h2>
                <FormattedText
                  text={brief.content.overview}
                  className="max-w-2xl font-serif text-[17px] leading-relaxed text-ink"
                />
                {brief.content.overviewCitations.length > 0 && (
                  <p className="mt-3 text-xs text-ink-3">
                    {t(lang, "sources")}:{" "}
                    {brief.content.overviewCitations.map((c, i) => (
                      <span key={c.n}>
                        {i > 0 && " · "}
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-line-2 underline-offset-2 hover:text-accent"
                        >
                          {c.source}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
              </section>
            )}

            {/* Brief sections */}
            {brief?.content.sections
              .filter((s) => s.key !== "watchlist")
              .map((section) => {
                const selected = (sectionArticles.get(section.key) ?? []).filter(
                  (a) => a.id !== hero?.id,
                );
                if (selected.length === 0) return null;
                const visual = section.key === "property" || section.key === "architecture";
                // Photo-led sections group illustrated stories first; text
                // sections keep pure relevance order.
                const arts = visual ? imageFirst(selected) : selected;
                return (
                  <section key={section.key} className="mt-12">
                    <h2 className="mb-5 flex items-baseline justify-between border-b border-line pb-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-ink">
                        {t(lang, SECTION_LABELS[section.key] ?? "moreForYou", { bilingual: true })}
                      </span>
                    </h2>
                    {visual ? (
                      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                        {arts.map((a) => (
                          <ArticleCard key={a.id} article={a} lang={lang} variant="visual" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {arts.map((a) => (
                          <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
          </div>

          {/* Rail */}
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

            {(sectionArticles.get("watchlist") ?? []).length > 0 && (
              <section>
                <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
                  {t(lang, "companyNews")}
                </h2>
                <div>
                  {(sectionArticles.get("watchlist") ?? []).map((a) => (
                    <ArticleCard key={a.id} article={a} lang={lang} variant="compact" />
                  ))}
                </div>
              </section>
            )}

            {more.length > 0 && (
              <section>
                <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
                  {t(lang, "moreForYou", { bilingual: true })}
                </h2>
                <div>
                  {more.map((a) => (
                    <ArticleCard key={a.id} article={a} lang={lang} variant="compact" />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
