/**
 * End-to-end local diagnostic of every subsystem.
 *   node scripts/diagnose.mjs [baseUrl]
 * Reports PASS / FAIL / SKIP (needs credentials) per feature. Read-only
 * except for temporary memory/alert rows, which it cleans up.
 */
const base = process.argv[2] ?? "http://localhost:3000";
const results = [];

const record = (area, state, detail) => results.push({ area, state, detail });

async function json(path, init) {
  const res = await fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

// ── configuration ────────────────────────────────────────────────────
const health = await json("/api/health");
const cfg = health.body?.config ?? {};
record(
  "Database",
  health.body?.databaseReachable ? "PASS" : "FAIL",
  `${cfg.database} · ${health.body?.articleCount ?? 0} articles`,
);
record("AI provider", cfg.aiConfigured ? "PASS" : "SKIP", cfg.aiConfigured ? `${cfg.aiProvider} (${cfg.aiModel})` : "no provider key set");
record("Market data", cfg.marketDataConfigured ? "PASS" : "SKIP", cfg.marketDataConfigured ? "configured" : "no TWELVE_DATA_API_KEY");
record("Auth gate", cfg.authEnabled ? "PASS" : "SKIP", cfg.authEnabled ? "enabled" : "open (no password / Google client)");
record("Telegram", cfg.telegramConfigured ? "PASS" : "SKIP", cfg.telegramConfigured ? "configured" : "not configured");

// ── pages ────────────────────────────────────────────────────────────
for (const [name, path] of [
  ["Today", "/"], ["Markets", "/markets"], ["Property", "/property"],
  ["Architecture", "/architecture"], ["Art", "/art"], ["Watchlist", "/watchlist"],
  ["Audio", "/audio"], ["Ask Tony", "/chat"], ["Saved", "/saved"],
  ["Settings", "/settings"], ["Search", "/search?q=property"],
]) {
  try {
    const res = await fetch(base + path);
    const html = await res.text();
    const articles = (html.match(/\/article\/\d+/g) ?? []).length;
    record(`Page: ${name}`, res.ok ? "PASS" : "FAIL", `HTTP ${res.status}, ${articles} article links`);
  } catch (e) {
    record(`Page: ${name}`, "FAIL", String(e.message).slice(0, 60));
  }
}

// ── Phase 2B APIs ────────────────────────────────────────────────────
const conv = await json("/api/conversations");
record("Conversation library", conv.body?.ok ? "PASS" : "FAIL", `${conv.body?.conversations?.length ?? 0} conversations`);

const mem = await json("/api/memories", { method: "POST", body: JSON.stringify({ content: "diagnostic probe memory" }) });
const memList = await json("/api/memories");
const probe = memList.body?.memories?.find((m) => m.content === "diagnostic probe memory");
record("Memories CRUD", mem.body?.ok && probe ? "PASS" : "FAIL", `${memList.body?.memories?.length ?? 0} stored`);
if (probe) await json(`/api/memories?id=${probe.id}`, { method: "DELETE" });

const alert = await json("/api/alerts", { method: "POST", body: JSON.stringify({ symbol: "DIAG.TEST", kind: "above", threshold: 1 }) });
const alertList = await json("/api/alerts");
const alertProbe = alertList.body?.alerts?.find((a) => a.symbol === "DIAG.TEST");
record("Market alerts CRUD", alert.body?.ok && alertProbe ? "PASS" : "FAIL", `${alertList.body?.alerts?.length ?? 0} alerts`);
if (alertProbe) await json(`/api/alerts?id=${alertProbe.id}`, { method: "DELETE" });

const lib = await json("/api/audio");
record("Audio library", lib.body?.ok ? "PASS" : "FAIL", `${lib.body?.episodes?.length ?? 0} episodes stored`);

// Audio generation (needs AI)
const gen = await json("/api/audio", { method: "POST", body: JSON.stringify({ format: "quick", language: "en" }) });
if (gen.body?.ok) {
  const segs = JSON.parse(gen.body.episode.transcript);
  record("Audio generation", "PASS", `${segs.length} segments, ${gen.body.episode.wordCount} words`);
} else {
  record("Audio generation", cfg.aiConfigured ? "FAIL" : "SKIP", gen.body?.error ?? `HTTP ${gen.status}`);
  if (gen.body?.error?.includes("reason") || gen.body?.reason) {
    record("  ↳ raw reason", "INFO", gen.body.reason ?? "");
  }
}

// Chat (needs AI)
const chat = await json("/api/chat", { method: "POST", body: JSON.stringify({ message: "What is important in Hong Kong property today?" }) });
record("Ask Tony chat", chat.body?.ok ? "PASS" : cfg.aiConfigured ? "FAIL" : "SKIP",
  chat.body?.ok ? `${chat.body.citations?.length ?? 0} citations` : (chat.body?.error ?? `HTTP ${chat.status}`));

// Search (FTS)
const search = await json("/api/search?q=property");
record("Search (FTS5)", search.body?.ok ? "PASS" : "FAIL", `${search.body?.results?.length ?? 0} results`);
const searchCjk = await json("/api/search?q=" + encodeURIComponent("香港"));
record("Search (CJK path)", searchCjk.body?.ok ? "PASS" : "FAIL", `${searchCjk.body?.results?.length ?? 0} results`);

// Sources health
const sources = await json("/api/sources");
const srcs = sources.body?.sources ?? [];
const healthy = srcs.filter((s) => s.lastStatus === "healthy").length;
const errored = srcs.filter((s) => s.lastStatus === "error");
record("Sources", errored.length === 0 ? "PASS" : "FAIL",
  `${healthy}/${srcs.length} healthy${errored.length ? " · errors: " + errored.map((s) => s.id).join(", ") : ""}`);

// ── report ───────────────────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.area.length));
console.log(`\nTONY DAILY — local diagnostic (${base})\n`);
for (const r of results) {
  const mark = { PASS: "PASS", FAIL: "FAIL", SKIP: "SKIP", INFO: "    " }[r.state];
  console.log(`  [${mark}] ${r.area.padEnd(width)}  ${r.detail}`);
}
const fails = results.filter((r) => r.state === "FAIL").length;
const skips = results.filter((r) => r.state === "SKIP").length;
console.log(`\n  ${results.filter((r) => r.state === "PASS").length} passing · ${fails} failing · ${skips} skipped (need credentials)\n`);
