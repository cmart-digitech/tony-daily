/**
 * Phase 2B behaviours: alert evaluation, audio script parsing, chat search
 * indexing, and comfort-preference merging — against a throwaway database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-p2b-"));
process.env.DATABASE_URL = path.join(tmpDir, "p2b.db");
delete process.env.TURSO_DATABASE_URL;

const { getDb } = await import("@/lib/db");
const { evaluateAlert, describeAlert } = await import("@/lib/alerts");
const { parseScript } = await import("@/lib/ai/audio");
const { chatFtsReady, indexChatMessage, searchConversations, removeConversationFromIndex } =
  await import("@/lib/search/fts");
const { getPreferences, savePreferences, trackVisit } = await import("@/lib/prefs");

beforeAll(async () => {
  await getDb();
});

describe("alert evaluation", () => {
  it("fires above/below thresholds inclusively", () => {
    expect(evaluateAlert({ kind: "above", threshold: 100 }, 100, null)).toBe(true);
    expect(evaluateAlert({ kind: "above", threshold: 100 }, 99.9, null)).toBe(false);
    expect(evaluateAlert({ kind: "below", threshold: 50 }, 50, null)).toBe(true);
    expect(evaluateAlert({ kind: "below", threshold: 50 }, 50.1, null)).toBe(false);
  });

  it("fires on daily moves in either direction", () => {
    expect(evaluateAlert({ kind: "move_pct", threshold: 5 }, 100, 5.2)).toBe(true);
    expect(evaluateAlert({ kind: "move_pct", threshold: 5 }, 100, -6)).toBe(true);
    expect(evaluateAlert({ kind: "move_pct", threshold: 5 }, 100, 4.9)).toBe(false);
  });

  it("never fires without data — no quote, no judgement", () => {
    expect(evaluateAlert({ kind: "above", threshold: 1 }, null, null)).toBe(false);
    expect(evaluateAlert({ kind: "move_pct", threshold: 1 }, 100, null)).toBe(false);
  });

  it("describes alerts in plain language", () => {
    expect(
      describeAlert({ id: 1, symbol: "0700.HK", kind: "below", threshold: 300 } as never),
    ).toContain("0700.HK at or below 300");
  });
});

describe("audio script parsing", () => {
  it("splits an anchor script into segments with detected language", () => {
    const segments = parseScript(
      "Good morning, Tony.\n\nMarkets first: the Hang Seng closed higher.\n\n港股方面，恒指高收。",
      "morning",
    );
    expect(segments).toHaveLength(3);
    expect(segments[0].speaker).toBe("ANCHOR");
    expect(segments[1].lang).toBe("en-US");
    expect(segments[2].lang).toBe("zh-HK");
  });

  it("assigns dialogue lines to their presenters", () => {
    const segments = parseScript(
      "ANNA: Good morning. Markets were quiet.\nBEN: They were — and property had one big story.",
      "dialogue",
    );
    expect(segments.map((s) => s.speaker)).toEqual(["ANNA", "BEN"]);
  });

  it("honours explicit [EN]/[粵] language tags in bilingual scripts", () => {
    const segments = parseScript("[EN] Markets rose today.\n\n[粵] 地產方面有新消息。", "morning");
    expect(segments[0].lang).toBe("en-US");
    expect(segments[1].lang).toBe("zh-HK");
    expect(segments[0].text).not.toContain("[EN]");
  });

  it("strips accidental code fences and empty lines", () => {
    const segments = parseScript("```\nGood morning.\n```", "quick");
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Good morning.");
  });

  it("trims a sentence the model was cut off mid-way through", () => {
    // Observed live: the budget ran out and the anchor stopped mid-figure.
    const segments = parseScript(
      "Good morning, Tony.\n\nCK Hutchison reported a large profit rise. MTR net profit more than doubled to 15.87 billion",
      "quick",
    );
    expect(segments).toHaveLength(2);
    expect(segments[1].text).toBe("CK Hutchison reported a large profit rise.");
  });

  it("drops a trailing paragraph that is entirely a fragment", () => {
    const segments = parseScript("Good morning, Tony.\n\nAnd in", "quick");
    expect(segments).toHaveLength(1);
  });

  it("does not mistake a decimal point for a sentence end", () => {
    const segments = parseScript(
      "Good morning.\n\nProfit rose to 15.87 billion dollars, the company said. Volumes were flat and",
      "quick",
    );
    expect(segments[1].text).toBe(
      "Profit rose to 15.87 billion dollars, the company said.",
    );
  });

  it("leaves a properly finished script untouched", () => {
    const segments = parseScript("Good morning.\n\nThat is your brief for today.", "quick");
    expect(segments).toHaveLength(2);
    expect(segments[1].text).toBe("That is your brief for today.");
  });
});

describe("chat message search index", () => {
  it("indexes messages and finds their conversations", async () => {
    expect(await chatFtsReady()).toBe(true);
    await indexChatMessage(1, 10, "We discussed the Tencent earnings outlook");
    await indexChatMessage(2, 11, "Henderson Land project timeline questions");
    const hits = await searchConversations("tencent earnings");
    expect(hits).toContain(10);
    expect(hits).not.toContain(11);
  });

  it("drops a conversation's messages from the index on delete", async () => {
    await removeConversationFromIndex(10);
    expect(await searchConversations("tencent earnings")).toEqual([]);
  });
});

describe("preferences: comfort + visit tracking", () => {
  it("merges stored partial comfort settings over defaults", async () => {
    await savePreferences({ comfort: { textSize: "large" } as never });
    const prefs = await getPreferences();
    expect(prefs.comfort.textSize).toBe("large");
    expect(prefs.comfort.lineSpacing).toBe("comfortable"); // untouched default
  });

  it("returns the previous visit and re-marks only after a quiet gap", async () => {
    const t0 = Date.now() - 60 * 60 * 1000;
    await savePreferences({ lastVisitAt: t0 });
    // An hour later: previous visit reported, marker refreshed.
    const prev = await trackVisit(Date.now());
    expect(prev).toBe(t0);
  });

  it("does not re-mark within a browsing session", async () => {
    const now = Date.now();
    await savePreferences({ lastVisitAt: now });
    await trackVisit(now + 5 * 60 * 1000); // 5 minutes later
    const prefs = await getPreferences();
    expect(prefs.lastVisitAt).toBe(now); // unchanged
  });
});
