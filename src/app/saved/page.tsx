import ArticleCard from "@/components/ArticleCard";
import { t } from "@/lib/i18n";
import { getArticles, savedArticleIds } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;
  const ids = [...(await savedArticleIds())];
  const articles = (await getArticles(ids)).sort((a, b) => b.fetchedAt - a.fetchedAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "saved", { bilingual: true })}
      </h1>
      {articles.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t(lang, "emptySaved")}</p>
      ) : (
        <div className="space-y-8">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
          ))}
        </div>
      )}
    </div>
  );
}
