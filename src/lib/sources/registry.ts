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
  type: "rss";
  tier: SourceTier;
  authority: number;
  /** Default categories; per-article classification can refine these. */
  categories: Category[];
  feedUrl: string;
  homepage: string;
  /** true for official/government sources whose statements are primary evidence. */
  primary: boolean;
  enabled: boolean;
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
];

export function getSource(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
