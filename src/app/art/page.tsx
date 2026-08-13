import ArticleCard from "@/components/ArticleCard";
import { t } from "@/lib/i18n";
import { imageFirst, pickLead } from "@/lib/layout";
import { articlesByCategory } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

/**
 * ART · 藝術 (brief §41–48): image-led art-market intelligence from
 * verified art publications. Auction structured data (events/lots) awaits a
 * legitimate structured source — nothing here is scraped or invented; every
 * card links to its publisher.
 */
export default async function ArtPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;
  const stories = await articlesByCategory(["art"], 25);
  const lead = pickLead(stories);
  const remaining = imageFirst(stories.filter((a) => a.id !== lead?.id));
  const [second, ...rest] = remaining;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "art", { bilingual: true })}
      </h1>
      {stories.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t(lang, "noVerifiedStories")}</p>
      ) : (
        <>
          {/* Expressive art-catalogue lead composition */}
          <div className="mb-14 grid grid-cols-1 gap-8 lg:grid-cols-5">
            {lead && (
              <div className="lg:col-span-3">
                <ArticleCard article={lead} lang={lang} variant="hero" />
              </div>
            )}
            {second && (
              <div className="lg:col-span-2 lg:pt-20">
                <ArticleCard article={second} lang={lang} variant="visual" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} variant="visual" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
