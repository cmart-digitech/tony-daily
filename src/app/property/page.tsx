import ArticleCard from "@/components/ArticleCard";
import { t } from "@/lib/i18n";
import { imageFirst, pickLead } from "@/lib/layout";
import { articlesByCategory } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function PropertyPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;
  const stories = await articlesByCategory(["property"], 24);
  // Ranking decides which stories appear; these only arrange them so the
  // photo-led grid reads evenly.
  const lead = pickLead(stories);
  const rest = imageFirst(stories.filter((a) => a.id !== lead?.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "propertyDevelopment", { bilingual: true })}
      </h1>
      {stories.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t(lang, "noVerifiedStories")}</p>
      ) : (
        <>
          {lead && (
            <div className="mb-12">
              <ArticleCard article={lead} lang={lang} variant="hero" />
            </div>
          )}
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
