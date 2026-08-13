const TZ = process.env.APP_TIMEZONE ?? "Asia/Hong_Kong";

export function hkTime(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

export function hkDateTime(ts: number, lang: "en" | "zh" = "en"): string {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

export function hkFullDate(lang: "en" | "zh" = "en", ts: number = Date.now()): string {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ts));
}

export function timeAgo(ts: number, lang: "en" | "zh" = "en", now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (lang === "zh") {
    if (min < 1) return "剛剛";
    if (min < 60) return `${min} 分鐘前`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} 小時前`;
    return `${Math.floor(h / 24)} 日前`;
  }
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function fmtPrice(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPercent(v: number | null): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function fmtVolume(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}
