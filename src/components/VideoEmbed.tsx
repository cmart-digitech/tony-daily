"use client";

import { useState } from "react";

/**
 * Click-to-load video embed (docs/VIDEO_POLICY.md).
 *
 * Until the reader presses play this is a thumbnail and a button — plain
 * markup, no iframe, and no request to Google. A page showing ten video
 * cards that mounted ten iframes would have contacted Google ten times
 * before anyone decided to watch anything, which is not acceptable for a
 * private dashboard.
 *
 * On click the iframe mounts against youtube-nocookie.com, so the
 * publisher's own player does the playing: their branding, their pre-roll.
 * We never host, proxy or re-encode the video itself.
 */
export default function VideoEmbed({
  videoId,
  title,
  thumbnail,
  source,
  watchUrl,
  embeddable = true,
  zh = false,
}: {
  videoId: string;
  title: string;
  thumbnail: string | null;
  source: string;
  watchUrl: string;
  /** false when the channel has disabled playback on other websites. */
  embeddable?: boolean;
  /** Traditional Chinese labels. */
  zh?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const L = zh
    ? {
        video: "影片",
        watchAt: `在${source}觀看`,
        watchAtLabel: `在${source}觀看（於新分頁開啟）：${title}`,
        play: `播放影片：${title}`,
        playsInPlace: `在此播放。原片：${watchUrl}`,
      }
    : {
        video: "Video",
        watchAt: `Watch at ${source}`,
        watchAtLabel: `Watch at ${source} (opens in a new tab): ${title}`,
        play: `Play video: ${title}`,
        playsInPlace: `Plays in place. Original: ${watchUrl}`,
      };

  // A channel that has disabled off-site playback gets a link, not a frame.
  // Embedding anyway would show YouTube's own error where a video should be,
  // and would be framing something we were asked not to frame.
  if (!embeddable) {
    return (
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={L.watchAtLabel}
        className="group relative block w-full overflow-hidden bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
        style={{ aspectRatio: "16 / 9" }}
      >
        {thumbnail && (
          // Plain img, never next/image — see the note below.
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-sm border border-white/60 bg-black/55 px-3 py-2 text-xs text-white transition-colors group-hover:bg-black/75">
          <span aria-hidden>▶</span>
          {L.watchAt}
        </span>
        <span className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-widest text-white/90">
          <span className="truncate">{source}</span>
          <span className="shrink-0 rounded-sm border border-white/40 px-1.5 py-0.5">{L.video}</span>
        </span>
      </a>
    );
  }

  if (playing) {
    return (
      <div className="relative w-full overflow-hidden bg-ink" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          // autoplay only ever follows an explicit press of the button below.
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={L.play}
      className="group relative block w-full overflow-hidden bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
      style={{ aspectRatio: "16 / 9" }}
    >
      {thumbnail ? (
        // Publisher thumbnail, served from their CDN. Deliberately a plain
        // img and never next/image: optimising it would fetch and re-encode
        // the file onto our own origin, which is the re-hosting the video
        // policy forbids.
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-ink-3">
          {source}
        </span>
      )}

      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white transition-colors group-hover:bg-black/70">
        <span aria-hidden className="ml-1 text-xl leading-none">
          ▶
        </span>
      </span>

      <span className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-widest text-white/90">
        <span className="truncate">{source}</span>
        <span className="shrink-0 rounded-sm border border-white/40 px-1.5 py-0.5">{L.video}</span>
      </span>

      {/* Kept out of the click target: the original stays one click away,
          which the data rules require of every story. */}
      <span className="sr-only">{L.playsInPlace}</span>
    </button>
  );
}
