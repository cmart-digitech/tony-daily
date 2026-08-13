import { describe, expect, it } from "vitest";
import { dayPart, getGreeting, greetingFor, hourInHK } from "@/lib/greeting";

/** Hong Kong is UTC+8 year round, so a UTC instant maps predictably. */
const atHK = (hkHour: number, day = 13) =>
  new Date(Date.UTC(2026, 7, day, (hkHour - 8 + 24) % 24, 0, 0));

describe("hourInHK", () => {
  it("reads the hour in Hong Kong, not the server timezone", () => {
    // 06:00 UTC is 14:00 in Hong Kong — the case that produced
    // "Good morning" on an afternoon page.
    expect(hourInHK(new Date(Date.UTC(2026, 7, 13, 6, 0, 0)))).toBe(14);
  });

  it("handles the day boundary", () => {
    // 20:00 UTC is 04:00 the next day in Hong Kong.
    expect(hourInHK(new Date(Date.UTC(2026, 7, 13, 20, 0, 0)))).toBe(4);
  });
});

describe("dayPart", () => {
  it("maps each part of the day", () => {
    expect(dayPart(5)).toBe("morning");
    expect(dayPart(11)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(17)).toBe("afternoon");
    expect(dayPart(18)).toBe("evening");
    expect(dayPart(22)).toBe("evening");
    expect(dayPart(23)).toBe("night");
    expect(dayPart(0)).toBe("night");
    expect(dayPart(4)).toBe("night");
  });
});

describe("getGreeting", () => {
  it("greets the afternoon in the afternoon", () => {
    const g = getGreeting(atHK(14));
    expect(g.part).toBe("afternoon");
    expect(g.en.toLowerCase()).toContain("afternoon");
    expect(g.en).not.toContain("morning");
  });

  it("greets the morning in the morning", () => {
    const g = getGreeting(atHK(8));
    expect(g.part).toBe("morning");
    expect(g.en.toLowerCase()).toContain("morning");
  });

  it("greets the evening in the evening", () => {
    expect(getGreeting(atHK(20)).en.toLowerCase()).toContain("evening");
  });

  it("always addresses Tony by name", () => {
    for (const hour of [3, 8, 14, 20]) {
      expect(getGreeting(atHK(hour)).en).toContain("Tony");
      expect(getGreeting(atHK(hour)).zh).toContain("Tony");
    }
  });

  it("uses Hong Kong Cantonese conventions in Chinese", () => {
    // 早晨 is the everyday HK morning greeting; 早安 is not used here.
    expect(getGreeting(atHK(8)).zh).toContain("早晨");
    expect(getGreeting(atHK(14)).zh).toContain("午安");
  });

  it("matches the subtitle to the hour", () => {
    expect(getGreeting(atHK(8)).subtitleEn).toBe("Your Daily Brief");
    expect(getGreeting(atHK(14)).subtitleEn).toBe("Your afternoon update");
    expect(getGreeting(atHK(20)).subtitleEn).toBe("Where the day landed");
  });

  it("stays stable across a single day, so it does not shuffle on reload", () => {
    const first = getGreeting(atHK(9));
    const later = getGreeting(atHK(11));
    expect(later.en).toBe(first.en);
  });

  it("varies across days, so the masthead is not static forever", () => {
    const seen = new Set(
      [13, 14, 15, 16].map((day) => getGreeting(atHK(9, day)).en),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("greetingFor", () => {
  it("renders English only", () => {
    const g = greetingFor("en", atHK(14));
    expect(g.title).not.toContain("·");
    expect(g.title).toContain("Tony");
  });

  it("renders Chinese only", () => {
    const g = greetingFor("zh", atHK(14));
    expect(g.title).toContain("午安");
    expect(g.title.toLowerCase()).not.toContain("afternoon");
  });

  it("renders both languages in bilingual mode", () => {
    const g = greetingFor("both", atHK(14));
    expect(g.title).toContain("·");
    expect(g.title.toLowerCase()).toContain("afternoon");
    expect(g.title).toContain("午安");
    expect(g.subtitle).toContain("·");
  });
});
