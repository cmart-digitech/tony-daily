import { getArticles } from "@/lib/queries";
import { getSource } from "@/lib/sources/registry";
import type { DailyBriefContent } from "@/lib/brief";

/**
 * Telegram delivery of the Daily Brief (free Bot API).
 *
 * Configured with TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; unconfigured
 * deployments skip silently and /api/health reports it. The message carries
 * the same content as the dashboard brief — real headlines with links to
 * the original sources, and the AI overview labelled as such — never
 * anything generated specially for the message.
 */

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

const SECTION_TITLES: Record<string, string> = {
  watchlist: "Watchlist · 自選股",
  hk: "Hong Kong · 香港",
  property: "Property · 地產",
  architecture: "Architecture · 建築",
  china: "Greater China / Asia · 大中華及亞太",
  global: "Global · 環球",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Compose the brief as Telegram HTML. Returns null when there is nothing real to send. */
export async function composeBriefMessage(
  content: DailyBriefContent,
  dateLabel: string,
): Promise<string | null> {
  const lines: string[] = [`<b>TONY·DAILY</b> — ${escapeHtml(dateLabel)}`];

  if (content.overview) {
    lines.push("", `<i>${escapeHtml(content.overview.replace(/\[\d+\]/g, "").trim())}</i>`);
    lines.push(`<i>(AI-assisted overview · AI 輔助摘要)</i>`);
  }

  let stories = 0;
  for (const section of content.sections) {
    const articles = await getArticles(section.articleIds.slice(0, 3));
    if (articles.length === 0) continue;
    lines.push("", `<b>${SECTION_TITLES[section.key] ?? section.key.toUpperCase()}</b>`);
    for (const a of articles) {
      const source = getSource(a.sourceId)?.name ?? a.sourceId;
      lines.push(
        `• <a href="${escapeHtml(a.canonicalUrl)}">${escapeHtml(a.originalTitle)}</a> — ${escapeHtml(source)}`,
      );
      stories++;
    }
  }
  if (stories === 0) return null; // nothing verified to send — send nothing

  return lines.join("\n").slice(0, 4000); // Telegram message limit is 4096
}

export async function sendBriefToTelegram(
  content: DailyBriefContent,
  dateLabel: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!telegramConfigured()) return { sent: false, reason: "not-configured" };
  const message = await composeBriefMessage(content, dateLabel);
  if (!message) return { sent: false, reason: "no-stories" };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, reason: `telegram-http-${res.status}: ${body.slice(0, 120)}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "network-error",
    };
  }
}
