import ArticleCard from "@/components/ArticleCard";
import { t } from "@/lib/i18n";
import { getPreferences } from "@/lib/prefs";
import { searchArticles } from "@/lib/retrieval";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const prefs = await getPreferences();
  const lang = prefs.language;
  const results = q ? await searchArticles(q, 30) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 font-serif text-3xl text-ink">
        {t(lang, "search", { bilingual: true })}
      </h1>
      <p className="mb-8 border-b border-line pb-4 text-sm text-ink-3">“{q}”</p>
      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">{t(lang, "noResults")}</p>
      ) : (
        <div className="space-y-8">
          {results.map((a) => (
            <ArticleCard key={a.id} article={a} lang={lang} variant="standard" />
          ))}
        </div>
      )}
    </div>
  );
}
