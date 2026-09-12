/**
 * Config-driven source registry.
 *
 * EVERY feedUrl below was verified live (HTTP 200, valid RSS with items)
 * before being committed (original set 2026-08-12; HKEX and SFC feeds
 * 2026-08-13). Do not add endpoints without verifying them first — never
 * guess a feed URL.
 *
 * authority: 0–100. Government/regulator ≈ 95–100, public broadcaster ≈ 90,
 * quality journalism ≈ 80–88, specialist design media ≈ 70–78.
 */

export type SourceTier = "A" | "B" | "C";
export type Category =
  | "markets"
  | "property"
  | "architecture"
  | "infrastructure"
  | "government"
  | "art"
  | "hk"
  | "china"
  | "world"
  | "general";

export interface SourceConfig {
  id: string;
  name: string;
  nameZh?: string;
  language: "en" | "zh-HK";
  region: "hk" | "china" | "apac" | "global";
  /**
   * "rss" is an article feed. "youtube" is a channel's Atom feed, which
   * carries a video id and a thumbnail instead of article text — see
   * docs/VIDEO_POLICY.md. Both are fetched by the same parser; only the
   * per-item mapping differs.
   */
  type: "rss" | "youtube";
  tier: SourceTier;
  authority: number;
  /** Default categories; per-article classification can refine these. */
  categories: Category[];
  feedUrl: string;
  homepage: string;
  /** true for official/government sources whose statements are primary evidence. */
  primary: boolean;
  enabled: boolean;
  /**
   * Video sources only. Some channels disable playback on other websites.
   * The video policy says a video we may not embed is a video we do not
   * embed -- so those render as a thumbnail linking to the publisher
   * instead of a player that would show YouTube's own error.
   *
   * Not detectable server-side without the paid YouTube Data API: oEmbed
   * returns 200 either way, and loading an embed outside a page context
   * fails with a referrer error that looks the same for everyone. So this
   * is verified by watching a card play in the running app, and recorded
   * here per channel. Undefined means embeddable.
   */
  embeddable?: boolean;
}

export const SOURCES: SourceConfig[] = [
  // ── Tier A — government / official ─────────────────────────────────
  {
    id: "hkgov-en-top",
    name: "HK Government News",
    nameZh: "香港政府新聞網",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["government", "hk"],
    feedUrl: "https://www.news.gov.hk/en/common/html/topstories.rss.xml",
    homepage: "https://www.news.gov.hk/en/",
    primary: true,
    enabled: true,
  },
  {
    id: "hkgov-zh-top",
    name: "HK Government News (中文)",
    nameZh: "香港政府新聞網",
    language: "zh-HK",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["government", "hk"],
    feedUrl: "https://www.news.gov.hk/tc/common/html/topstories.rss.xml",
    homepage: "https://www.news.gov.hk/tc/",
    primary: true,
    enabled: true,
  },
  {
    id: "hkgov-en-infrastructure",
    name: "HK Gov — Infrastructure & Logistics",
    nameZh: "香港政府新聞網 — 基建與物流",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["infrastructure", "government", "hk"],
    feedUrl:
      "https://www.news.gov.hk/en/categories/infrastructure/html/articlelist.rss.xml",
    homepage: "https://www.news.gov.hk/en/categories/infrastructure/",
    primary: true,
    enabled: true,
  },
  {
    id: "hkgov-zh-infrastructure",
    name: "HK Gov — 基建與物流",
    nameZh: "香港政府新聞網 — 基建與物流",
    language: "zh-HK",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["infrastructure", "government", "hk"],
    feedUrl:
      "https://www.news.gov.hk/tc/categories/infrastructure/html/articlelist.rss.xml",
    homepage: "https://www.news.gov.hk/tc/categories/infrastructure/",
    primary: true,
    enabled: true,
  },
  {
    id: "hkgov-en-finance",
    name: "HK Gov — Business & Finance",
    nameZh: "香港政府新聞網 — 財經",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["markets", "government", "hk"],
    feedUrl:
      "https://www.news.gov.hk/en/categories/finance/html/articlelist.rss.xml",
    homepage: "https://www.news.gov.hk/en/categories/finance/",
    primary: true,
    enabled: true,
  },

  {
    id: "hkex-news",
    name: "HKEX — News Releases",
    nameZh: "香港交易所 — 新聞稿",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["markets", "hk"],
    feedUrl: "https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=en",
    homepage: "https://www.hkex.com.hk/News/News-Release?sc_lang=en",
    primary: true,
    enabled: true,
  },
  {
    id: "hkex-regulatory",
    name: "HKEX — Regulatory Announcements",
    nameZh: "香港交易所 — 監管通告",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["markets", "hk"],
    feedUrl:
      "https://www.hkex.com.hk/Services/RSS-Feeds/regulatory-announcements?sc_lang=en",
    homepage: "https://www.hkex.com.hk/News/Regulatory-Announcements?sc_lang=en",
    primary: true,
    enabled: true,
  },
  {
    id: "sfc-press",
    name: "SFC — Press Releases",
    nameZh: "證監會 — 新聞稿",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "A",
    authority: 100,
    categories: ["markets", "government", "hk"],
    feedUrl: "https://www.sfc.hk/en/RSS-Feeds/Press-releases",
    homepage: "https://www.sfc.hk/en/News-and-announcements/News/",
    primary: true,
    enabled: true,
  },

  // ── Tier B — public broadcaster / quality journalism ───────────────
  {
    id: "rthk-en-local",
    name: "RTHK — Hong Kong",
    nameZh: "香港電台",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["hk", "general"],
    feedUrl: "https://rthk.hk/rthk/news/rss/e_expressnews_elocal.xml",
    homepage: "https://news.rthk.hk/rthk/en/",
    primary: false,
    enabled: true,
  },
  {
    id: "rthk-en-finance",
    name: "RTHK — Finance",
    nameZh: "香港電台 — 財經",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["markets", "hk"],
    feedUrl: "https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml",
    homepage: "https://news.rthk.hk/rthk/en/",
    primary: false,
    enabled: true,
  },
  {
    id: "rthk-en-greaterchina",
    name: "RTHK — Greater China",
    nameZh: "香港電台 — 大中華",
    language: "en",
    region: "china",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["china"],
    feedUrl: "https://rthk.hk/rthk/news/rss/e_expressnews_egreaterchina.xml",
    homepage: "https://news.rthk.hk/rthk/en/",
    primary: false,
    enabled: true,
  },
  {
    id: "rthk-en-world",
    name: "RTHK — World",
    nameZh: "香港電台 — 國際",
    language: "en",
    region: "global",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["world"],
    feedUrl: "https://rthk.hk/rthk/news/rss/e_expressnews_einternational.xml",
    homepage: "https://news.rthk.hk/rthk/en/",
    primary: false,
    enabled: true,
  },
  {
    id: "rthk-zh-local",
    name: "RTHK 本地新聞",
    nameZh: "香港電台 — 本地",
    language: "zh-HK",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["hk", "general"],
    feedUrl: "https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml",
    homepage: "https://news.rthk.hk/rthk/ch/",
    primary: false,
    enabled: true,
  },
  {
    id: "rthk-zh-finance",
    name: "RTHK 財經新聞",
    nameZh: "香港電台 — 財經",
    language: "zh-HK",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 90,
    categories: ["markets", "hk"],
    feedUrl: "https://rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml",
    homepage: "https://news.rthk.hk/rthk/ch/",
    primary: false,
    enabled: true,
  },
  {
    id: "scmp-hk",
    name: "SCMP — Hong Kong",
    nameZh: "南華早報 — 香港",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 82,
    categories: ["hk", "general"],
    feedUrl: "https://www.scmp.com/rss/2/feed",
    homepage: "https://www.scmp.com/news/hong-kong",
    primary: false,
    enabled: true,
  },
  {
    id: "scmp-business",
    name: "SCMP — Business",
    nameZh: "南華早報 — 財經",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 82,
    categories: ["markets"],
    feedUrl: "https://www.scmp.com/rss/92/feed",
    homepage: "https://www.scmp.com/business",
    primary: false,
    enabled: true,
  },
  {
    id: "scmp-property",
    name: "SCMP — Property",
    nameZh: "南華早報 — 地產",
    language: "en",
    region: "hk",
    type: "rss",
    tier: "B",
    authority: 82,
    categories: ["property"],
    feedUrl: "https://www.scmp.com/rss/96/feed",
    homepage: "https://www.scmp.com/property",
    primary: false,
    enabled: true,
  },
  {
    id: "bbc-business",
    name: "BBC — Business",
    language: "en",
    region: "global",
    type: "rss",
    tier: "B",
    authority: 85,
    categories: ["world", "markets"],
    feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    homepage: "https://www.bbc.com/news/business",
    primary: false,
    enabled: true,
  },

  // ── Tier C — specialist built-environment / design media ───────────
  {
    id: "dezeen",
    name: "Dezeen",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 76,
    categories: ["architecture"],
    feedUrl: "https://www.dezeen.com/feed/",
    homepage: "https://www.dezeen.com",
    primary: false,
    enabled: true,
  },
  {
    id: "archdaily",
    name: "ArchDaily",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 75,
    categories: ["architecture"],
    feedUrl: "https://www.archdaily.com/feed",
    homepage: "https://www.archdaily.com",
    primary: false,
    enabled: true,
  },
  // ── Tier C — art-market / art media (verified live 2026-08-13) ─────
  {
    id: "theartnewspaper",
    name: "The Art Newspaper",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 78,
    categories: ["art"],
    feedUrl: "https://www.theartnewspaper.com/rss.xml",
    homepage: "https://www.theartnewspaper.com",
    primary: false,
    enabled: true,
  },
  {
    id: "artasiapacific",
    name: "ArtAsiaPacific",
    language: "en",
    region: "apac",
    type: "rss",
    tier: "C",
    authority: 74,
    categories: ["art"],
    feedUrl: "https://artasiapacific.com/rss",
    homepage: "https://artasiapacific.com",
    primary: false,
    enabled: true,
  },
  {
    id: "artnet-news",
    name: "Artnet News",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 74,
    categories: ["art"],
    feedUrl: "https://news.artnet.com/feed",
    homepage: "https://news.artnet.com",
    primary: false,
    enabled: true,
  },
  {
    id: "hyperallergic",
    name: "Hyperallergic",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 70,
    categories: ["art"],
    feedUrl: "https://hyperallergic.com/feed/",
    homepage: "https://hyperallergic.com",
    primary: false,
    enabled: true,
  },
  {
    id: "designboom",
    name: "designboom",
    language: "en",
    region: "global",
    type: "rss",
    tier: "C",
    authority: 72,
    categories: ["architecture"],
    feedUrl: "https://www.designboom.com/feed/",
    homepage: "https://www.designboom.com",
    primary: false,
    enabled: true,
  },

  // ── Video — YouTube channel feeds ──────────────────────────────────
  //
  // Every channel id below was resolved from its canonical URL and its feed
  // fetched and confirmed to contain entries on 12 Sept 2026. Channels that
  // resolved but returned an EMPTY feed were rejected rather than added
  // hopefully: HK01, @scmp (the publishing channel is
  // @southchinamorningpost) and Bloomberg Television (@markets carries the
  // items). See docs/VIDEO_POLICY.md.
  //
  // Authority mirrors each publisher's text feed -- a broadcaster's video
  // desk is the same newsroom -- so video competes on the same terms and is
  // never promoted merely for being video.
  {
    id: "yt-rthk",
    name: "RTHK News (video)",
    nameZh: "香港電台新聞（影片）",
    language: "zh-HK",
    region: "hk",
    type: "youtube",
    tier: "B",
    authority: 90,
    categories: ["hk"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCwuTCNZqSMfaiP63cGDb8LQ",
    homepage: "https://www.youtube.com/@rthk_news",
    primary: false,
    enabled: true,
    // Verified in the running app on 12 Sept 2026: the embed returns
    // "Playback on other websites has been disabled by the video owner".
    // Their videos are linked to, never framed.
    embeddable: false,
  },
  {
    id: "yt-tvb-news",
    name: "TVB News (video)",
    nameZh: "無綫新聞（影片）",
    language: "zh-HK",
    region: "hk",
    type: "youtube",
    tier: "B",
    authority: 82,
    categories: ["hk"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_ifDTtFAcsj-wJ5JfM27CQ",
    homepage: "https://www.youtube.com/@tvbnewsofficial",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-now-news",
    name: "Now News (video)",
    nameZh: "now新聞（影片）",
    language: "zh-HK",
    region: "hk",
    type: "youtube",
    tier: "B",
    authority: 82,
    categories: ["hk"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCnwaU7j34C92ywMHXJahHRA",
    homepage: "https://www.youtube.com/@NowTV",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-scmp",
    name: "SCMP (video)",
    language: "en",
    region: "hk",
    type: "youtube",
    tier: "B",
    authority: 85,
    categories: ["hk"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC4SUWizzKc1tptprBkWjX2Q",
    homepage: "https://www.youtube.com/@southchinamorningpost",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-scmp-tv",
    name: "SCMP TV",
    language: "en",
    region: "hk",
    type: "youtube",
    tier: "B",
    authority: 84,
    categories: ["hk"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCezZxnyyvF9Yv3qqfM1Gn7A",
    homepage: "https://www.youtube.com/@SCMPTV",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-bbc-news",
    name: "BBC News (video)",
    language: "en",
    region: "global",
    type: "youtube",
    tier: "B",
    authority: 88,
    categories: ["world"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA",
    homepage: "https://www.youtube.com/@bbcnews",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-reuters",
    name: "Reuters (video)",
    language: "en",
    region: "global",
    type: "youtube",
    tier: "B",
    authority: 88,
    categories: ["world"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UChqUTb7kYRX8-EiaN3XFrSQ",
    homepage: "https://www.youtube.com/@reuters",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-bloomberg",
    name: "Bloomberg Markets (video)",
    language: "en",
    region: "global",
    type: "youtube",
    tier: "B",
    authority: 86,
    categories: ["markets"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCIALMKvObZNtJ6AmdCLP7Lg",
    homepage: "https://www.youtube.com/@markets",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-dezeen",
    name: "Dezeen (video)",
    language: "en",
    region: "global",
    type: "youtube",
    tier: "C",
    authority: 76,
    categories: ["architecture"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsWG9ANbrmgR0z-eFk_A3YQ",
    homepage: "https://www.youtube.com/@dezeen",
    primary: false,
    enabled: true,
  },
  {
    id: "yt-archdaily",
    name: "ArchDaily (video)",
    language: "en",
    region: "global",
    type: "youtube",
    tier: "C",
    authority: 74,
    categories: ["architecture"],
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UC3r_kdJocuqtDYb2GgM42Ng",
    homepage: "https://www.youtube.com/@archdaily",
    primary: false,
    enabled: true,
  },
];

export function getSource(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
