import Link from "next/link";
import type { ArticleRow } from "@/lib/retrieval";
import { getSource } from "@/lib/sources/registry";
import { timeAgo } from "@/lib/format";
import { type UiLanguage } from "@/lib/i18n";
import ArticlePlaceholder from "./ArticlePlaceholder";
import VerificationBadge from "./VerificationBadge";

/**
 * Marks a card whose story is a video, so a reader can tell before clicking.
 * Deliberately quiet: video is an attribute, not a promotion, and this must
 * not read as a badge that makes video look more important than text.
 * No runtime is shown because the feed does not carry one
 * (docs/VIDEO_POLICY.md).
 *
 * Overlaid on a photo where the card has one; inline in the meta line where
 * it does not (standard and compact rows), so no variant hides the fact.
 */
function VideoMark({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <span
      className={
        inline
          ? "inline-flex items-center gap-1 uppercase tracking-widest text-[10px] text-ink-2"
          : "absolute left-2 top-2 flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-white"
      }
    >
      <span aria-hidden>▶</span>
      {label}
    </span>
  );
}

export type CardVariant = "hero" | "visual" | "standard" | "compact";

/**
 * Editorial article card. "visual" gives photography generous space
 * (architecture/property); "compact" is a dense list row (markets).
 * Images are real publisher/feed images only — no image means an elegant
 * typographic placeholder, never a substitute photo.
 */
export default function ArticleCard({
  article,
  lang,
  variant = "standard",
}: {
  article: ArticleRow;
  lang: UiLanguage;
  variant?: CardVariant;
}) {
  const source = getSource(article.sourceId);
  const ago = article.publishedAt
    ? timeAgo(article.publishedAt, lang === "zh" ? "zh" : "en")
    : timeAgo(article.fetchedAt, lang === "zh" ? "zh" : "en");
  const href = `/article/${article.id}`;
  // Show the AI-assisted translation when the reader's language differs
  // from the headline's (always in bilingual mode). Labelled, never silent.
  const showTranslation =
    lang === "both" ||
    (lang === "zh" && article.originalLanguage !== "zh-HK") ||
    (lang === "en" && article.originalLanguage !== "en");

  const videoLabel = lang === "zh" ? "影片" : "Video";
  // Image variants carry the mark on the photo; the rest carry it here.
  const inlineVideoMark =
    Boolean(article.videoId) &&
    (variant === "compact" || variant === "standard" || !article.imageUrl);

  const meta = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
      {inlineVideoMark && (
        <>
          <VideoMark label={videoLabel} inline />
          <span aria-hidden>·</span>
        </>
      )}
      <span className="font-medium text-ink-2">{source?.name ?? article.sourceId}</span>
      <span aria-hidden>·</span>
      <span>{ago}</span>
      <VerificationBadge status={article.verificationStatus} lang={lang} />
    </p>
  );

  if (variant === "hero") {
    return (
      <article className="group">
        <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-accent">
          {article.imageUrl ? (
            <figure className="relative mb-4 aspect-video w-full overflow-hidden bg-subtle">
              <img
                src={article.imageUrl}
                alt={article.originalTitle}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
              />
              {article.imageAttribution && (
                <figcaption className="absolute bottom-0 right-0 bg-black/50 px-2 py-0.5 text-[10px] text-white">
                  {article.imageAttribution}
                </figcaption>
              )}
              {article.videoId && <VideoMark label={videoLabel} />}
            </figure>
          ) : (
            <ArticlePlaceholder
              seed={article.id}
              sourceName={source?.name ?? article.sourceId}
              category={article.category}
              lang={lang === "zh" ? "zh" : "en"}
              className="mb-4 aspect-video w-full"
            />
          )}
          <h2 className="font-serif text-2xl leading-snug text-ink group-hover:text-accent sm:text-3xl">
            {article.originalTitle}
          </h2>
          {showTranslation && article.translatedTitle && (
            <p className="mt-1.5 font-serif text-lg leading-snug text-ink-2">
              {article.translatedTitle}
              <span className="ml-1.5 align-middle font-sans text-[9px] uppercase tracking-wider text-ink-3">
                AI 譯
              </span>
            </p>
          )}
        </Link>
        {article.excerpt && (
          <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-ink-2">
            {article.excerpt}
          </p>
        )}
        <div className="mt-3">{meta}</div>
      </article>
    );
  }

  if (variant === "visual") {
    return (
      <article className="group">
        <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-accent">
          {article.imageUrl ? (
            <figure className="relative mb-3 aspect-[4/3] w-full overflow-hidden bg-subtle">
              <img
                src={article.imageUrl}
                alt={article.originalTitle}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {article.videoId && <VideoMark label={videoLabel} />}
            </figure>
          ) : (
            <ArticlePlaceholder
              seed={article.id}
              sourceName={source?.name ?? article.sourceId}
              category={article.category}
              lang={lang === "zh" ? "zh" : "en"}
              className="mb-3 aspect-[4/3] w-full"
            />
          )}
          <h3 className="font-serif text-lg leading-snug text-ink group-hover:text-accent">
            {article.originalTitle}
          </h3>
        </Link>
        <div className="mt-2">{meta}</div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="border-b border-line py-3 last:border-b-0">
        <Link
          href={href}
          className="block text-[15px] leading-snug text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          {article.originalTitle}
        </Link>
        <div className="mt-1.5">{meta}</div>
      </article>
    );
  }

  return (
    <article className="group flex gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block font-serif text-base leading-snug text-ink group-hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          {article.originalTitle}
        </Link>
        {article.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{article.excerpt}</p>
        )}
        <div className="mt-2">{meta}</div>
      </div>
      {article.imageUrl && (
        <Link href={href} tabIndex={-1} className="shrink-0">
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-28 object-cover"
          />
        </Link>
      )}
    </article>
  );
}
