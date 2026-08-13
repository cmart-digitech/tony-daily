export type UiLanguage = "en" | "zh" | "both";

/** UI strings. zh values follow Hong Kong Traditional Chinese conventions. */
const STRINGS = {
  today: { en: "Today", zh: "今日" },
  markets: { en: "Markets", zh: "市場" },
  property: { en: "Property", zh: "地產" },
  architecture: { en: "Architecture", zh: "建築" },
  watchlist: { en: "Watchlist", zh: "自選股" },
  saved: { en: "Saved", zh: "收藏" },
  settings: { en: "Settings", zh: "設定" },
  askTonyDaily: { en: "Ask Tony Daily", zh: "問 Tony Daily" },
  goodMorning: { en: "Good morning, Tony", zh: "Tony，早晨" },
  dailyBrief: { en: "Your Daily Brief", zh: "今日簡報" },
  marketSnapshot: { en: "Market snapshot", zh: "市場概況" },
  yourWatchlist: { en: "Tony's watchlist", zh: "自選股焦點" },
  hongKong: { en: "Hong Kong", zh: "香港" },
  propertyDevelopment: { en: "Property + Development", zh: "地產與發展" },
  builtEnvironment: { en: "Architecture + Built Environment", zh: "建築與城市" },
  greaterChinaAsia: { en: "Greater China / Asia", zh: "大中華及亞太" },
  globalWatch: { en: "Global watch", zh: "環球視野" },
  moreForYou: { en: "More for you", zh: "更多精選" },
  refreshBrief: { en: "Refresh brief", zh: "更新簡報" },
  refreshing: { en: "Refreshing…", zh: "更新中…" },
  save: { en: "Save", zh: "收藏" },
  unsave: { en: "Unsave", zh: "取消收藏" },
  summarise: { en: "Summarise", zh: "摘要" },
  askAboutThis: { en: "Ask about this", zh: "查詢此新聞" },
  openSource: { en: "Open source", zh: "閱讀原文" },
  originalHeadline: { en: "Original headline", zh: "原文標題" },
  sources: { en: "Sources", zh: "資料來源" },
  alsoReportedBy: { en: "Also reported by", zh: "其他報道" },
  relatedStories: { en: "Related stories", zh: "相關新聞" },
  relatedCompanies: { en: "Related companies", zh: "相關公司" },
  primaryVerified: { en: "Primary source", zh: "官方來源" },
  corroborated: { en: "Corroborated", zh: "多方引述" },
  singleSource: { en: "Single source", zh: "單一來源" },
  newsRefreshed: { en: "News refreshed", zh: "新聞更新於" },
  marketDataUpdated: { en: "Market data updated", zh: "市場數據更新於" },
  delayed: { en: "Delayed", zh: "延遲數據" },
  endOfDay: { en: "End-of-day", zh: "收市數據" },
  realTime: { en: "Real-time", zh: "即時數據" },
  noVerifiedStories: {
    en: "No verified stories found. Try refreshing the brief.",
    zh: "暫無經核實的新聞，請嘗試更新簡報。",
  },
  marketDataUnavailable: {
    en: "Market data temporarily unavailable.",
    zh: "市場數據暫時無法提供。",
  },
  marketDataNotConfigured: {
    en: "Market data is not configured. Add TWELVE_DATA_API_KEY to .env.local.",
    zh: "尚未設定市場數據。請在 .env.local 加入 TWELVE_DATA_API_KEY。",
  },
  aiNotConfigured: {
    en: "AI is not configured. Add ANTHROPIC_API_KEY to .env.local.",
    zh: "尚未設定 AI。請在 .env.local 加入 ANTHROPIC_API_KEY。",
  },
  imageUnavailable: { en: "Image unavailable", zh: "沒有圖片" },
  addStock: { en: "Add stock", zh: "新增股票" },
  searchTicker: { en: "Search ticker or company…", zh: "搜尋股票代號或公司…" },
  remove: { en: "Remove", zh: "移除" },
  favourite: { en: "Favourite", zh: "置頂" },
  emptyWatchlist: {
    en: "Your watchlist is empty. Search above to add Hong Kong or US securities.",
    zh: "自選股清單仍然是空的，可在上方搜尋香港或美國股票。",
  },
  emptySaved: { en: "No saved stories yet.", zh: "尚未收藏任何新聞。" },
  disclaimer: {
    en: "Market information is provided for informational purposes and is not financial advice.",
    zh: "市場資訊僅供參考，並不構成投資建議。",
  },
  aiSummaryLabel: { en: "AI-assisted summary", zh: "AI 輔助摘要" },
  translationLabel: { en: "AI translation — see original", zh: "AI 翻譯，請參閱原文" },
  sourceHealth: { en: "Source health", zh: "來源狀態" },
  language: { en: "Language", zh: "語言" },
  theme: { en: "Theme", zh: "外觀" },
  light: { en: "Light", zh: "淺色" },
  dark: { en: "Dark", zh: "深色" },
  system: { en: "System", zh: "跟隨系統" },
  briefingTime: { en: "Morning briefing time", zh: "早晨簡報時間" },
  interests: { en: "Interest weighting", zh: "興趣比重" },
  search: { en: "Search", zh: "搜尋" },
  searchEverything: { en: "Search news, companies, places…", zh: "搜尋新聞、公司、地點…" },
  noResults: { en: "No results in the indexed sources.", zh: "已編入索引的來源中找不到結果。" },
  updated: { en: "Updated", zh: "更新於" },
  published: { en: "Published", zh: "發佈於" },
  fetchedLabel: { en: "Indexed", zh: "收錄於" },
  min30sec: { en: "30 sec", zh: "30 秒" },
  min2: { en: "2 min", zh: "2 分鐘" },
  deepDive: { en: "Deep dive", zh: "深入解讀" },
  send: { en: "Send", zh: "送出" },
  overview: { en: "Overview", zh: "總覽" },
  companyNews: { en: "Company announcements & market news", zh: "公司公告及市場新聞" },
  economyPolicy: { en: "Economic / policy news", zh: "經濟及政策新聞" },
  onboardingWelcome: { en: "Welcome to Tony Daily", zh: "歡迎使用 Tony Daily" },
  next: { en: "Next", zh: "下一步" },
  back: { en: "Back", zh: "上一步" },
  finish: { en: "Start reading", zh: "開始閱讀" },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a UI string. In "both" mode, headers show both languages. */
export function t(lang: UiLanguage, key: StringKey, opts?: { bilingual?: boolean }): string {
  const s: { en: string; zh: string } = STRINGS[key];
  if (lang === "zh") return s.zh;
  if (lang === "both" && opts?.bilingual && s.en !== s.zh) return `${s.en} · ${s.zh}`;
  return s.en;
}

/** Content language to request from AI features for the current UI language. */
export function aiLanguage(lang: UiLanguage): "en" | "zh-HK" {
  return lang === "zh" ? "zh-HK" : "en";
}
