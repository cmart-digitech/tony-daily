import Link from "next/link";
import VideoEmbed from "@/components/VideoEmbed";
import { getSource } from "@/lib/sources/registry";
import { articlesWithVideo } from "@/lib/queries";
import { getPreferences } from "@/lib/prefs";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * VIDEO · 影片 — news video from verified broadcaster and publisher
 * channels, Hong Kong and international.
 *
 * Every card is thumbnail-only until pressed: no iframe mounts, and nothing
 * is requested from Google, until the reader chooses to watch. Playback runs
 * in the publisher's own embed — we hold the id and thumbnail and nothing
 * else. See docs/VIDEO_POLICY.md.
 */
export default async function VideoPage() {
  const prefs = await getPreferences();
  const zh = prefs.language === "zh";
  const stories = await articlesWithVideo(30);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6">
      <h1 className="mb-2 border-b-2 border-ink pb-4 font-serif text-3xl text-ink">
        {zh ? "影片 · Video" : "Video · 影片"}
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-ink-2">
        {zh
          ? "來自已核實新聞頻道的影片報道，香港及國際。所有影片均由原出版機構的播放器播放；按下播放前不會載入任何外部內容。"
          : "News video from verified broadcaster and publisher channels, Hong Kong and international. Everything plays in the publisher's own player — nothing loads until you press play."}
      </p>

      {stories.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          {zh ? "暫時未有影片。" : "No video available yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((a) => {
            const src = getSource(a.sourceId);
            const name = zh && src?.nameZh ? src.nameZh : src?.name ?? a.sourceId;
            return (
              <article key={a.id} className="flex flex-col">
                <VideoEmbed
                  videoId={a.videoId!}
                  title={a.originalTitle}
                  thumbnail={a.imageUrl}
                  source={name}
                  watchUrl={a.canonicalUrl}
                  embeddable={src?.embeddable !== false}
                />
                <h2 className="mt-3 font-serif text-lg leading-snug text-ink">
                  <Link href={`/article/${a.id}`} className="hover:text-accent">
                    {a.originalTitle}
                  </Link>
                </h2>
                <p className="mt-2 text-[11px] uppercase tracking-widest text-ink-3">
                  {name}
                  {a.publishedAt ? ` · ${timeAgo(a.publishedAt, zh ? "zh" : "en")}` : ""}
                </p>
                {/* The original is always one click away (data rules). */}
                <a
                  href={a.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[11px] text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-accent"
                >
                  {zh ? "在原網站觀看" : "Watch at source"}
                </a>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
