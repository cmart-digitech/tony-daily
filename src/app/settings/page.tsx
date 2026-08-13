import SettingsPanel from "@/components/SettingsPanel";
import SourceTable from "@/components/SourceTable";
import { t } from "@/lib/i18n";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prefs = await getPreferences();
  const lang = prefs.language;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "settings", { bilingual: true })}
      </h1>
      <SettingsPanel
        initial={prefs}
        lang={lang}
        labels={{
          language: t(lang, "language"),
          theme: t(lang, "theme"),
          light: t(lang, "light"),
          dark: t(lang, "dark"),
          system: t(lang, "system"),
          briefingTime: t(lang, "briefingTime"),
          interests: t(lang, "interests"),
        }}
      />
      <section className="mt-14">
        <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
          {t(lang, "sourceHealth", { bilingual: true })}
        </h2>
        <SourceTable />
      </section>
    </div>
  );
}
