import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCachedQuote, isMarketDataConfigured } from "@/lib/market";
import { sendTelegramMessage } from "@/lib/notify/telegram";

/**
 * User-created market alerts (brief §39). Checked from the scheduled
 * ingestion using the cached quote layer, so no extra provider load. An
 * alert re-arms after a cool-off rather than firing on every check, and it
 * reports the quote's own timestamp — never implying real-time knowledge.
 */

const RETRIGGER_COOLOFF_MS = 20 * 60 * 60 * 1000; // once per day in practice

export type AlertRow = typeof schema.stockAlerts.$inferSelect;

export function describeAlert(a: AlertRow): string {
  if (a.kind === "above") return `${a.symbol} at or above ${a.threshold}`;
  if (a.kind === "below") return `${a.symbol} at or below ${a.threshold}`;
  return `${a.symbol} moves more than ${a.threshold}% in a day`;
}

export function evaluateAlert(
  a: Pick<AlertRow, "kind" | "threshold">,
  price: number | null,
  percentChange: number | null,
): boolean {
  if (a.kind === "above") return price != null && price >= a.threshold;
  if (a.kind === "below") return price != null && price <= a.threshold;
  if (a.kind === "move_pct") {
    return percentChange != null && Math.abs(percentChange) >= a.threshold;
  }
  return false;
}

export async function checkAlerts(): Promise<number> {
  if (!isMarketDataConfigured()) return 0;
  const db = await getDb();
  const alerts = (await db.select().from(schema.stockAlerts).all()).filter(
    (a) => a.enabled,
  );
  if (alerts.length === 0) return 0;

  let triggered = 0;
  const now = Date.now();
  for (const alert of alerts) {
    if (alert.lastTriggeredAt && now - alert.lastTriggeredAt < RETRIGGER_COOLOFF_MS) {
      continue;
    }
    let price: number | null = null;
    let percentChange: number | null = null;
    let fetchedAt = now;
    let currency: string | null = null;
    try {
      const quote = await getCachedQuote(alert.symbol);
      price = quote.price;
      percentChange = quote.percentChange;
      fetchedAt = quote.fetchedAt;
      currency = quote.currency;
    } catch {
      continue; // no quote → no judgement, never a fake trigger
    }
    if (!evaluateAlert(alert, price, percentChange)) continue;

    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: process.env.APP_TIMEZONE ?? "Asia/Hong_Kong",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(fetchedAt));
    const message =
      `${describeAlert(alert)} — now ${currency ?? ""} ${price ?? "?"}` +
      (percentChange != null
        ? ` (${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%)`
        : "") +
      ` · quote ${time} HKT (delayed)`;

    await db
      .insert(schema.alertEvents)
      .values({ alertId: alert.id, triggeredAt: now, message })
      .run();
    await db
      .update(schema.stockAlerts)
      .set({ lastTriggeredAt: now })
      .where(eq(schema.stockAlerts.id, alert.id))
      .run();
    await sendTelegramMessage(`🔔 <b>TONY·DAILY alert</b>\n${message}`);
    triggered++;
  }
  return triggered;
}
