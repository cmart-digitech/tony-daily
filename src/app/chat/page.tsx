import ChatPanel from "@/components/ChatPanel";
import { isAiConfigured } from "@/lib/ai";
import { t } from "@/lib/i18n";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const prefs = await getPreferences();
  const lang = prefs.language;

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-3xl flex-col px-4 py-8 sm:px-6">
      <h1 className="mb-6 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {t(lang, "askTonyDaily", { bilingual: true })}
      </h1>
      <div className="min-h-0 flex-1">
        <ChatPanel
          aiConfigured={isAiConfigured()}
          initialQuestion={q}
          labels={{
            placeholder:
              lang === "zh" ? "問啲關於今日新聞或市場嘅嘢…" : "Ask about today's news or markets…",
            send: t(lang, "send"),
            notConfigured: t(lang, "aiNotConfigured"),
            sources: t(lang, "sources"),
          }}
        />
      </div>
    </div>
  );
}
