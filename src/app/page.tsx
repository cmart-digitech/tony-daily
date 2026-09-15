import Link from "next/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import FormattedText from "@/components/FormattedText";
import ListenTodayButton from "@/components/ListenTodayButton";
import RefreshBriefButton from "@/components/RefreshBriefButton";
import SinceLastVisit from "@/components/SinceLastVisit";
import WatchlistMini from "@/components/WatchlistMini";
import { isAiConfigured } from "@/lib/ai";
import { generateDailyBrief, getTodaysBrief } from "@/lib/brief";
import { hkFullDate, timeAgo } from "@/lib/format";
import { greetingFor } from "@/lib/greeting";
import { t } from "@/lib/i18n";
import { imageFirst } from "@/lib/layout";
import { lastRefreshedAt } from "@/lib/ingest";
import { refreshIfStale } from "@/lib/ingest/freshness";
import { getArticles, topStories, watchlist, watchlistNews } from "@/lib/queries";
import { getPreferences, trackVisit } from "@/lib/prefs";
import type { ArticleRow } from "@/lib/retrieval";

export const dynamic = "force-dynamic";
/**
 * Room for a background refresh to finish after the page has been sent. The
 * reader never waits on it -- after() runs once the response is out -- but
 * the function has to stay alive long enough to fetch the publishers. A
 * full refresh measures ~18s; this leaves headroom without holding a
 * function open indefinitely.
 */
export const maxDuration = 60;

const SECTION_LABELS: Record<string, Parameters<typeof t>[1]> = {
  watchlist: "yourWatchlist",
  hk: "hongKong",
  property: "propertyDevelopment",
  architecture: "builtEnvironment",
  art: "artAuctions",
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
  // An empty brief is rebuilt rather than kept. If the day's first view
  // lands before any story has been indexed -- the news stale, its refresh
  // still running in the background -- the brief comes out with no
  // sections, and caching that left Today blank until midnight. Rebuilding
  // an empty brief makes no AI call: there is nothing yet to summarise.
  if (!brief || brief.content.sections.length === 0) {
    // First view of the day: build the brief from already-indexed stories.
    try {
      await generateDailyBrief();
      brief = await getTodaysBrief();
    } catch {
      brief = null;
    }
  }

  // Independent of each other — issue them together rather than in series.
  const [refreshedAt, watchItems, ranked, watchNews] = await Promise.all([
    lastRefreshedAt(),
    watchlist(),
    topStories(40),
    watchlistNews(20),
  ]);

  // Stale news refreshes itself on visit, in the background, so freshness no
  // longer hangs on a scheduler that GitHub delays at exactly the minutes we
  // had chosen. This render uses what is already held; the next one gets
  // the new stories. See src/lib/ingest/freshness.ts.
  after(() => refreshIfStale(refreshedAt) ?? undefined);

  // SINCE YOUR LAST VISIT (brief §54): what the ranking already considers
  // important, filtered to items indexed after the previous visit.
  const previousVisit = await trackVisit();
  const watchNewIds = new Set(watchNews.map((a) => a.id));
  const fresh = previousVisit ? ranked.filter((a) => a.fetchedAt > previousVisit) : [];
  const sinceGroups = [
    { key: "watchlist", en: "watchlist developments", zhL: "項自選股相關", articles: fresh.filter((a) => watchNewIds.has(a.id)).slice(0, 3) },
    { key: "hk", en: "Hong Kong stories", zhL: "項香港新聞", articles: fresh.filter((a) => a.region === "hk" && !watchNewIds.has(a.id) && a.category !== "property" && a.category !== "architecture").slice(0, 3) },
    { key: "property", en: "property items", zhL: "項地產新聞", articles: fresh.filter((a) => a.category === "property").slice(0, 3) },
    { key: "architecture", en: "architecture stories", zhL: "項建築新聞", articles: fresh.filter((a) => a.category === "architecture" || a.category === "infrastructure").slice(0, 3) },
    { key: "art", en: "art items", zhL: "項藝術新聞", articles: fresh.filter((a) => a.category === "art").slice(0, 3) },
  ];

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
        <div className="flex flex-wrap items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-ink-3">
              {t(lang, "newsRefreshed")} {timeAgo(refreshedAt, zh)}
            </span>
          )}
          <ListenTodayButton
            language={lang === "zh" ? "zh-HK" : lang === "both" ? "bilingual" : "en"}
            label={t(lang, "listenToBrief")}
            aiConfigured={isAiConfigured()}
          />
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

      {previousVisit && (
        <SinceLastVisit since={previousVisit} groups={sinceGroups} zh={lang === "zh"} />
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
                const visual =
                  section.key === "property" ||
                  section.key === "architecture" ||
                  section.key === "art";
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
