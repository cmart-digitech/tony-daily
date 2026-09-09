import { describe, expect, it } from "vitest";
import { classifyCategory, classifyRegion } from "@/lib/ingest/classify";
import { getSource } from "@/lib/sources/registry";

const rthk = getSource("rthk-en-local")!;
const dezeen = getSource("dezeen")!;
const scmpProperty = getSource("scmp-property")!;

describe("classifyCategory", () => {
  it("detects property stories from a general source", () => {
    expect(
      classifyCategory("Developer wins Kai Tak land sale tender at record premium", rthk),
    ).toBe("property");
  });
  it("detects markets stories in Chinese", () => {
    expect(classifyCategory("恒生指數收市升逾200點", rthk)).toBe("markets");
  });
  it("falls back to the source specialism", () => {
    expect(classifyCategory("A quiet pavilion of light and timber", dezeen)).toBe(
      "architecture",
    );
  });
  it("keeps property specialism for ambiguous content", () => {
    expect(classifyCategory("Weekly review of the sector", scmpProperty)).toBe("property");
  });
});

describe("incident guard", () => {
  it("keeps a fatal tunnel crash out of the built-environment sections", () => {
    // Real headline that previously led the Architecture section.
    expect(
      classifyCategory(
        "司機疑暈倒旅遊巴失事撞壆 昏迷送院後死亡 城門隧道往荃灣方向管道下午3時許發生致命交通意外",
        rthk,
      ),
    ).toBe("general");
  });

  it("keeps an English road accident out of infrastructure", () => {
    expect(
      classifyCategory(
        "School bus crashes in Shing Mun Tunnel after driver loses consciousness, 1 injured",
        rthk,
      ),
    ).toBe("general");
  });

  it("keeps a village fire out of the property section", () => {
    expect(
      classifyCategory(
        "Man injured as fire engulfs 2 huts, 4 speedboats at village in Sai Kung",
        rthk,
      ),
    ).toBe("general");
  });

  it("still classifies genuine infrastructure policy news", () => {
    expect(
      classifyCategory(
        "Consultation begins on the new railway extension and tunnel safety guidelines",
        rthk,
      ),
    ).toBe("infrastructure");
  });

  it("still classifies land sales and planning stories", () => {
    expect(
      classifyCategory("Developer wins Kai Tak land sale tender at record premium", rthk),
    ).toBe("property");
  });

  it("lets a design publisher keep an incident story on its own beat", () => {
    // Dezeen reporting on a fire that damaged a landmark building is still
    // architecture coverage; a general newsroom's crash story is not.
    expect(
      classifyCategory("Fire damages listed pavilion by the architect", dezeen),
    ).toBe("architecture");
  });
});

describe("classifyRegion", () => {
  it("detects Hong Kong", () => {
    expect(classifyRegion("MTR announces new Kwun Tong line works", dezeen)).toBe("hk");
  });
  it("detects mainland China", () => {
    expect(classifyRegion("Shenzhen tech firms rally", dezeen)).toBe("china");
  });
  it("falls back to source region", () => {
    expect(classifyRegion("A new concert hall opens", dezeen)).toBe("global");
  });
});

describe("art section only carries art", () => {
  const scmpBusiness = getSource("scmp-business")!;
  const hkgovEn = getSource("hkgov-en-top")!;
  const hkgovZh = getSource("hkgov-zh-top")!;
  const artNewspaper = getSource("theartnewspaper")!;
  const artnet = getSource("artnet-news")!;

  // Real headlines that were wrongly filling the Art section. Each one
  // matched a bare venue word — "exhibition", "galleries", 展覽 — in
  // trade-show, government or product copy.
  it("keeps a biotech five-year plan out of Art", () => {
    expect(
      classifyCategory(
        "Hong Kong targets biomedicine powerhouse status in debut 5-year plan. " +
          "BIOHK2026 展覽 drew investors to the forum.",
        scmpBusiness,
      ),
    ).not.toBe("art");
  });

  it("keeps a Belt and Road summit out of Art", () => {
    expect(classifyCategory("CE spotlights HK at Belt-Road Summit exhibition", hkgovEn)).not.toBe(
      "art",
    );
    expect(classifyCategory("逾六千政商領袖出席一帶一路論壇及展覽", hkgovZh)).not.toBe("art");
  });

  it("keeps a design-product story out of Art", () => {
    expect(
      classifyCategory("Bugaboo makes pram from orange peel and old egg cartons", dezeen),
    ).not.toBe("art");
  });

  it("keeps design galleries and design fairs out of Art", () => {
    // Real Dezeen headlines: the design trade, not the art market.
    expect(
      classifyCategory(
        "Five galleries injecting renewed energy into the London design scene. " +
          "A clutch of young design galleries are shaking the cobwebs off London.",
        dezeen,
      ),
    ).not.toBe("art");
    expect(
      classifyCategory(
        "Beton Brut and Isokon reimagine Marcel Breuer furniture. " +
          "Design gallery Beton Brut has teamed up with manufacturer Isokon.",
        dezeen,
      ),
    ).not.toBe("art");
  });

  it("does not treat a passing artist credit as an art story", () => {
    // Real Dezeen headline: the subject is a building, not the artwork.
    expect(
      classifyCategory(
        "Crystal-shaped sauna rises from former industrial site in Sweden. " +
          "Stockholm-based artist duo Bigert & Bergstrom has created a sauna.",
        dezeen,
      ),
    ).not.toBe("art");
  });

  it("keeps a science museum out of Art", () => {
    expect(classifyCategory("Science Museum reopens after refit", rthk)).not.toBe("art");
  });

  // ...while genuine art coverage still lands there.
  it("still classifies auction-market news as art", () => {
    expect(
      classifyCategory("$60 Million Modernist Trove Led by Rare Signacs Heads to Auction", artnet),
    ).toBe("art");
    expect(
      classifyCategory("Two Renoir paintings worth EUR9m stolen from Renoir Museum", artNewspaper),
    ).toBe("art");
  });

  it("still classifies artists and artworks as art from a general source", () => {
    expect(
      classifyCategory("Museum acquires major artwork by a Hong Kong artist", rthk),
    ).toBe("art");
  });

  it("classifies a qualified art exhibition from a general source", () => {
    expect(classifyCategory("M+ opens a major art exhibition this autumn", rthk)).toBe("art");
    expect(classifyCategory("香港美術館舉行藝術展覽", getSource("rthk-zh-local")!)).toBe("art");
  });

  it("keeps dedicated art publishers on their beat without keyword help", () => {
    // No art keyword at all — the source default must still carry it.
    expect(classifyCategory("A quiet week in the trade", artNewspaper)).toBe("art");
  });
});
