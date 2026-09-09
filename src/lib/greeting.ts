/**
 * Time-aware masthead greeting.
 *
 * The hour is always read in Hong Kong time, not the server's timezone, so
 * the greeting matches the reader's day rather than the deployment region.
 *
 * Wording is warm but unhurried — this is a considered morning read for a
 * retired architect, not a consumer app. Variants rotate by date so the
 * page has some life without changing under the reader on every refresh.
 */

export type DayPart = "morning" | "afternoon" | "evening" | "night";

const TZ = process.env.APP_TIMEZONE ?? "Asia/Hong_Kong";

/** Hour 0–23 in the app's timezone. */
export function hourInHK(now: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(formatted);
}

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

/**
 * Greeting variants per part of day. Traditional Chinese follows Hong Kong
 * usage — 早晨 is the everyday Cantonese morning greeting, not 早安.
 */
const GREETINGS: Record<DayPart, { en: string; zh: string }[]> = {
  morning: [
    { en: "Good morning", zh: "早晨" },
    { en: "A good morning to you", zh: "早晨好" },
    { en: "Morning — here is the day", zh: "早晨，今日概覽" },
  ],
  afternoon: [
    { en: "Good afternoon", zh: "午安" },
    { en: "A good afternoon to you", zh: "午安，下午好" },
  ],
  evening: [
    { en: "Good evening", zh: "晚安" },
    { en: "A good evening to you", zh: "晚上好" },
  ],
  night: [
    { en: "Good evening", zh: "夜安" },
    { en: "A quiet hour", zh: "夜深了" },
  ],
};

/** Sub-heading that matches the hour: a brief in the morning, a catch-up later. */
const SUBTITLES: Record<DayPart, { en: string; zh: string }> = {
  morning: { en: "Your Daily Brief", zh: "今日簡報" },
  afternoon: { en: "Your afternoon update", zh: "午間更新" },
  evening: { en: "Where the day landed", zh: "今日回顧" },
  night: { en: "Where the day landed", zh: "今日回顧" },
};

/** Stable within a day, so the wording does not shuffle on every reload. */
function dayIndex(now: Date): number {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return Number(key.replace(/-/g, "")) || 0;
}

export interface Greeting {
  part: DayPart;
  en: string;
  zh: string;
  subtitleEn: string;
  subtitleZh: string;
}

export function getGreeting(now: Date = new Date()): Greeting {
  const part = dayPart(hourInHK(now));
  const options = GREETINGS[part];
  const chosen = options[dayIndex(now) % options.length];
  const subtitle = SUBTITLES[part];
  return {
    part,
    en: chosen.en,
    zh: chosen.zh,
    subtitleEn: subtitle.en,
    subtitleZh: subtitle.zh,
  };
}

/** Render for the current interface language, matching the bilingual style. */
export function greetingFor(
  lang: "en" | "zh" | "both",
  now: Date = new Date(),
): { title: string; subtitle: string } {
  const g = getGreeting(now);
  if (lang === "zh") return { title: g.zh, subtitle: g.subtitleZh };
  if (lang === "both") {
    return {
      title: `${g.en} · ${g.zh}`,
      subtitle: `${g.subtitleEn} · ${g.subtitleZh}`,
    };
  }
  return { title: g.en, subtitle: g.subtitleEn };
}
