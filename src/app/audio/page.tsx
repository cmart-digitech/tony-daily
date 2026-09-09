import AudioLibrary from "@/components/AudioLibrary";
import { isAiConfigured } from "@/lib/ai";
import { audioFormatAvailability } from "@/lib/ai/audio";
import { hkDateKey } from "@/lib/brief";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function AudioPage() {
  const prefs = await getPreferences();
  const zh = prefs.language === "zh";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="mb-2 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {zh ? "The Daily 音訊" : "The Daily Audio"}
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-2">
        {zh
          ? "以真實新聞來源生成的早晨簡報同對談節目。文稿完全根據已核實的文章撰寫，播放使用裝置本身的語音。"
          : "News-anchor briefings and conversational episodes, scripted only from today's verified stories. Playback uses your device's own voices — nothing is uploaded."}
      </p>
      <AudioLibrary
        aiConfigured={isAiConfigured()}
        todayKey={hkDateKey()}
        availability={audioFormatAvailability()}
      />
    </div>
  );
}
