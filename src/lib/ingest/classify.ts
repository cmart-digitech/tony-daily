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

/**
 * Accidents, crime and casualties. A crash in a tunnel or a fire in a
 * building mentions built-environment vocabulary, but it is general news —
 * not architecture, property or infrastructure reporting. Without this
 * guard a fatal road accident can lead the Architecture section.
 */
const INCIDENT_KEYWORDS: RegExp[] = [
  /\b(crash(ed|es)?|collision|accident|derail(ed|ment)?|injur(ed|y|ies)|kill(ed|ing)?|dead|death|died|fatal|casualt(y|ies)|blaze|fire (broke|engulf|rag)|arrest(ed)?|charged|assault|robbery|murder|stabb(ed|ing)|jail(ed)?|doxx?ing|fraud|smuggl)/i,
  /失事|撞[毀壆車]|車禍|意外|死亡|喪生|受傷|傷者|昏迷|墮斃|火警|縱火|拘捕|被捕|檢控|判囚|行劫|謀殺|襲擊|盜竊|詐騙/,
];

/**
 * Signals that a story is genuinely about policy, development or the
 * industry, strong enough to survive the incident guard (e.g. a report on
 * tunnel safety regulations rather than a crash inside one).
 */
const DOMAIN_OVERRIDE: RegExp[] = [
  /\b(consultation|policy|ordinance|regulation|tender|land sale|planning apply|planning application|masterplan|budget|approv(ed|al)|guidelines?|framework|review of|study|blueprint|design(ed) by|architects? (has|have|said)|completed|unveil(ed|s)?|opens?|scheme)\b/i,
  /諮詢|政策|條例|規例|招標|賣地|規劃|藍圖|指引|檢討|研究|落成|啟用|動工|開幕|設計/,
];

function isIncident(text: string): boolean {
  if (!INCIDENT_KEYWORDS.some((re) => re.test(text))) return false;
  return !DOMAIN_OVERRIDE.some((re) => re.test(text));
}

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
  // Built-environment sections must not fill up with accidents and crime.
  const incident = isIncident(text);
  const builtEnvironment = new Set(["property", "architecture", "infrastructure"]);

  for (const cat of priority) {
    if (!CATEGORY_KEYWORDS[cat]?.some((re) => re.test(text))) continue;
    // A specialist design/property publisher reporting an incident is still
    // covering its beat; a general newsroom's crash story is not.
    if (incident && builtEnvironment.has(cat) && !source.categories.includes(cat)) {
      return "general";
    }
    return cat;
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
