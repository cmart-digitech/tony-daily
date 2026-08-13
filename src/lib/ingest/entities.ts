/**
 * Lightweight lexical entity extraction. Only extracts what is literally
 * present in the text — never infers relationships.
 */

export interface ExtractedEntity {
  entity: string;
  entityType: "ticker" | "company" | "location" | "department" | "index";
}

/** Well-known HK-listed companies ↔ tickers (used for watchlist ↔ news linking). */
const KNOWN_COMPANIES: { pattern: RegExp; entity: string; ticker?: string }[] = [
  { pattern: /tencent|騰訊/i, entity: "Tencent", ticker: "0700.HK" },
  { pattern: /alibaba|阿里巴巴/i, entity: "Alibaba", ticker: "9988.HK" },
  { pattern: /hsbc|滙豐|汇丰/i, entity: "HSBC", ticker: "0005.HK" },
  { pattern: /\bmtr\b|港鐵/i, entity: "MTR Corporation", ticker: "0066.HK" },
  { pattern: /sun hung kai|新鴻基/i, entity: "Sun Hung Kai Properties", ticker: "0016.HK" },
  { pattern: /\bck asset|長實/i, entity: "CK Asset", ticker: "1113.HK" },
  { pattern: /henderson land|恒基/i, entity: "Henderson Land", ticker: "0012.HK" },
  { pattern: /new world development|新世界發展/i, entity: "New World Development", ticker: "0017.HK" },
  { pattern: /swire properties|太古地產/i, entity: "Swire Properties", ticker: "1972.HK" },
  { pattern: /link reit|領展/i, entity: "Link REIT", ticker: "0823.HK" },
  { pattern: /wharf reic|九龍倉置業/i, entity: "Wharf REIC", ticker: "1997.HK" },
  { pattern: /sino land|信和置業/i, entity: "Sino Land", ticker: "0083.HK" },
  { pattern: /hang lung|恒隆/i, entity: "Hang Lung Properties", ticker: "0101.HK" },
  { pattern: /\bhkex\b|港交所|香港交易所/i, entity: "HKEX", ticker: "0388.HK" },
  { pattern: /\bboc hong kong|中銀香港/i, entity: "BOC Hong Kong", ticker: "2388.HK" },
  { pattern: /cathay pacific|國泰航空/i, entity: "Cathay Pacific", ticker: "0293.HK" },
  { pattern: /\bmeituan|美團/i, entity: "Meituan", ticker: "3690.HK" },
  { pattern: /\bxiaomi|小米/i, entity: "Xiaomi", ticker: "1810.HK" },
  { pattern: /\bbyd\b|比亞迪/i, entity: "BYD", ticker: "1211.HK" },
  { pattern: /\bapple\b/i, entity: "Apple", ticker: "AAPL" },
  { pattern: /\bnvidia\b/i, entity: "Nvidia", ticker: "NVDA" },
  { pattern: /\btesla\b/i, entity: "Tesla", ticker: "TSLA" },
];

const DEPARTMENTS: RegExp[] = [
  /Development Bureau|發展局/i,
  /Planning Department|規劃署/i,
  /Lands Department|地政總署/i,
  /Buildings Department|屋宇署/i,
  /Housing (Bureau|Authority)|房屋局|房委會/i,
  /Urban Renewal Authority|市建局|市區重建局/i,
  /Transport and Logistics Bureau|運輸及物流局/i,
  /Securities and Futures Commission|證監會/i,
  /Hong Kong Monetary Authority|金管局|金融管理局/i,
  /Rating and Valuation Department|差餉物業估價署/i,
];

const LOCATIONS: RegExp[] = [
  /Kai Tak|啟德/i,
  /Northern Metropolis|北部都會區/i,
  /Lantau|大嶼山/i,
  /West Kowloon|西九/i,
  /Central( District)?|中環/,
  /Tsim Sha Tsui|尖沙咀/i,
  /Kwun Tong|觀塘/i,
  /Sha Tin|沙田/i,
  /Tung Chung|東涌/i,
  /Kowloon East|九龍東/i,
];

const INDEXES: { pattern: RegExp; entity: string }[] = [
  { pattern: /hang seng index|恒生指數|\bhsi\b/i, entity: "HSI" },
  { pattern: /s&p ?500/i, entity: "S&P 500" },
  { pattern: /nasdaq/i, entity: "NASDAQ" },
  { pattern: /dow jones/i, entity: "Dow Jones" },
];

/** Explicit tickers written in the text, e.g. "0700.HK" or "(0700)" */
const TICKER_RE = /\b(\d{4,5})\.HK\b|\（(\d{4,5})\）|\((\d{4,5})\)/g;

export function extractEntities(text: string): ExtractedEntity[] {
  const out: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const push = (entity: string, entityType: ExtractedEntity["entityType"]) => {
    const key = `${entityType}:${entity}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ entity, entityType });
    }
  };

  for (const c of KNOWN_COMPANIES) {
    if (c.pattern.test(text)) {
      push(c.entity, "company");
      if (c.ticker) push(c.ticker, "ticker");
    }
  }
  for (const d of DEPARTMENTS) {
    const m = text.match(d);
    if (m) push(m[0], "department");
  }
  for (const l of LOCATIONS) {
    const m = text.match(l);
    if (m) push(m[0], "location");
  }
  for (const i of INDEXES) {
    if (i.pattern.test(text)) push(i.entity, "index");
  }
  let m: RegExpExecArray | null;
  TICKER_RE.lastIndex = 0;
  while ((m = TICKER_RE.exec(text)) !== null) {
    const code = m[1] ?? m[2] ?? m[3];
    if (code) push(`${code.padStart(4, "0")}.HK`, "ticker");
  }
  return out;
}
