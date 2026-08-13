import type { Category, SourceConfig } from "@/lib/sources/registry";

/**
 * Keyword-based category/region refinement. The source's own default
 * categories set the baseline; content keywords can promote an article
 * into a more specific bucket (e.g. an RTHK local story about a land sale
 * → property). Purely lexical — no invention.
 */

const CATEGORY_KEYWORDS: Record<string, RegExp[]> = {
  property: [
    /\b(propert(y|ies)|real estate|housing|land sale|land premium|tender|home price|rents?|residential|office leasing|mortgage|developer|redevelopment|urban renewal|estate|flats?)\b/i,
    /地產|樓市|樓價|物業|住宅|賣地|地皮|發展商|按揭|租金|收購重建|居屋|公屋/,
  ],
  architecture: [
    /\b(architect(ure|s|ural)?|design museum|pavilion|skyscraper|tower design|urban design|masterplan|renovation|adaptive reuse|heritage building|biennale)\b/i,
    /建築師|建築設計|城市設計|保育|活化/,
  ],
  infrastructure: [
    /\b(infrastructure|railway|rail link|metro|mtr|airport|runway|bridge|tunnel|highway|reclamation|northern metropolis|kai tak|lantau)\b/i,
    /基建|鐵路|機場|跑道|大橋|隧道|填海|北部都會區|啟德/,
  ],
  markets: [
    /\b(stocks?|equit(y|ies)|hang seng|hsi|ipo|shares?|bond|earnings|dividend|market|index|nasdaq|s&p|dow|fed|interest rate|hkex|listing|profit warning|buyback)\b/i,
    /股市|恒指|恒生指數|港股|美股|上市|集資|供股|回購|派息|業績|加息|減息|債券/,
  ],
  government: [
    /\b(government|bureau|legislative council|legco|policy address|budget|ordinance|regulation|consultation)\b/i,
    /政府|立法會|施政報告|財政預算|條例|諮詢/,
  ],
};

const REGION_KEYWORDS: Record<string, RegExp[]> = {
  hk: [
    /\b(hong ?kong|hk|kowloon|new territories|hang seng|hkex|mtr|legco|north point|central district|tsim sha tsui|sha tin|kai tak)\b/i,
    /香港|九龍|新界|港島|恒指|港交所|港鐵/,
  ],
  china: [
    /\b(china|chinese|beijing|shanghai|shenzhen|guangzhou|mainland|taiwan|macau|greater bay area|prc|yuan|renminbi)\b/i,
    /中國|內地|北京|上海|深圳|廣州|大灣區|人民幣|台灣|澳門/,
  ],
  apac: [
    /\b(japan|tokyo|korea|seoul|singapore|asean|australia|india|vietnam|thailand|indonesia|malaysia|asia[- ]pacific)\b/i,
    /日本|東京|南韓|首爾|新加坡|澳洲|印度|越南|泰國|亞太/,
  ],
};

export function classifyCategory(
  text: string,
  source: SourceConfig,
): Category {
  // Specialist sources keep their specialism unless content clearly differs.
  const priority: Category[] = [
    "property",
    "architecture",
    "infrastructure",
    "markets",
    "government",
  ];
  for (const cat of priority) {
    if (CATEGORY_KEYWORDS[cat]?.some((re) => re.test(text))) return cat;
  }
  const first = source.categories[0];
  if (first && first !== "hk" && first !== "china" && first !== "world") {
    return first;
  }
  return "general";
}

export function classifyRegion(
  text: string,
  source: SourceConfig,
): "hk" | "china" | "apac" | "global" {
  if (REGION_KEYWORDS.hk.some((re) => re.test(text))) return "hk";
  if (REGION_KEYWORDS.china.some((re) => re.test(text))) return "china";
  if (REGION_KEYWORDS.apac.some((re) => re.test(text))) return "apac";
  return source.region;
}
