import MemoriesPanel from "@/components/MemoriesPanel";
import ReadingComfortPanel from "@/components/ReadingComfortPanel";
import SettingsPanel from "@/components/SettingsPanel";
import SignOutButton from "@/components/SignOutButton";
import SourceTable from "@/components/SourceTable";
import { authEnabled } from "@/lib/auth";
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
          {lang === "zh" ? "閱讀設定" : "Reading Comfort · 閱讀設定"}
        </h2>
        <ReadingComfortPanel initial={prefs.comfort} zh={lang === "zh"} />
      </section>
      <section className="mt-14">
        <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
          {lang === "zh" ? "Tony Daily 記住咗啲乜" : "What Tony Daily Remembers"}
        </h2>
        <MemoriesPanel zh={lang === "zh"} />
      </section>
      <section className="mt-14">
        <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
          {t(lang, "sourceHealth", { bilingual: true })}
        </h2>
        <SourceTable />
      </section>

      <section className="mt-14">
        <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
          {lang === "zh" ? "私隱與帳戶" : "Privacy & account"}
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-ink-2">
          {lang === "zh"
            ? "所有資料只儲存喺你自己嘅資料庫：對話、記憶、收藏、自選股同音訊文稿。你可以喺上面逐項刪除。"
            : "Everything is stored in your own database — conversations, memories, saved articles, watchlist and audio transcripts. Each can be deleted from its own section above."}
        </p>
        {authEnabled() ? (
          <SignOutButton label={lang === "zh" ? "登出" : "Sign out"} />
        ) : (
          <p className="text-sm text-ink-3">
            {lang === "zh"
              ? "此部署未設定登入保護，任何知道網址嘅人都可以查看。"
              : "No sign-in is configured on this deployment — anyone with the URL can read it."}
          </p>
        )}
      </section>
    </div>
  );
}
