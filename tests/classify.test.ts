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

describe("'flat' means an apartment, not an idiom", () => {
  const bbc = getSource("bbc-business")!;
  const bloomberg = getSource("yt-bloomberg")!;

  it("still files flats as property", () => {
    // Real headlines.
    expect(
      classifyCategory("Hong Kong homebuyers snap up 138 Garden Regency flats in New Territories project", rthk),
    ).toBe("property");
    expect(
      classifyCategory("Hong Kong’s subdivided flats are turning into heat traps. But what’s the fix?", rthk),
    ).toBe("property");
    expect(classifyCategory("China’s first-tier new home prices flat in July", rthk)).toBe(
      "property",
    );
  });

  it("files a singular flat as property where the context makes it a home", () => {
    expect(classifyCategory("Falling flat prices hit owners in Tuen Mun", rthk)).toBe("property");
    expect(classifyCategory("Government to buy back subdivided flat units", rthk)).toBe("property");
    expect(
      classifyCategory("Hong Kong’s red-hot rental market forces students to flat-hunt as early as April", rthk),
    ).toBe("property");
  });

  it("does not file a flat market reading as property", () => {
    // Found by review: each matched the first version of the rule.
    const markets = getSource("rthk-en-finance")!;
    for (const headline of [
      "Hang Seng Index ends flat",
      "HK stocks open flat",
      "Asian shares mostly flat",
      "Retail sales flat in August",
    ]) {
      expect(classifyCategory(headline, markets), headline).not.toBe("property");
    }
    expect(classifyCategory("New flat-screen displays unveiled", rthk)).not.toBe("property");
    expect(classifyCategory("A house with a flat roof and deep eaves", dezeen)).toBe("architecture");
  });

  it("does not file the idiom or the landform as property", () => {
    // Real headlines, each previously filed under Property.
    expect(
      classifyCategory("Dramatic insider warnings over AI fall flat with some in Silicon Valley", bbc),
    ).not.toBe("property");
    expect(
      classifyCategory("Moynihan Says Bank Is Still Strong, Even If Trading Revenue Comes In Flat", bloomberg),
    ).not.toBe("property");
    expect(
      classifyCategory('Gregory Orekhov places black fabric in "endless white surface" of Utah salt flats', dezeen),
    ).toBe("architecture");
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

describe("art means art, not the art world's politics", () => {
  const artNewspaper = getSource("theartnewspaper")!;
  const hyper = getSource("hyperallergic")!;

  // Real headlines that were leading the Art section.
  it("keeps a museum director's resignation out of Art", () => {
    expect(
      classifyCategory(
        "Lonnie Bunch's Resignation Is a Wake-Up Call. Smithsonian Secretary steps down amid attacks.",
        hyper,
      ),
    ).not.toBe("art");
    expect(
      classifyCategory("Smithsonian leader Lonnie G. Bunch to retire", artNewspaper),
    ).not.toBe("art");
  });

  it("keeps a funding bill out of Art", () => {
    expect(
      classifyCategory(
        "How Trump's signature bill could make arts education in the US even more expensive",
        artNewspaper,
      ),
    ).not.toBe("art");
  });

  it("keeps a staff walkout out of Art", () => {
    expect(
      classifyCategory("Striking Workers Shutter Three V&A London Locations", hyper),
    ).not.toBe("art");
  });

  it("still keeps institutional stories that are ABOUT art", () => {
    // A resignation is not art; a resignation over a disputed painting is.
    expect(
      classifyCategory(
        "Director resigns after the museum returns a Nazi-looted Old Master painting",
        artNewspaper,
      ),
    ).toBe("art");
  });

  it("recognises makers and works the old list missed", () => {
    for (const headline of [
      "A Painter Once Silenced by East Germany Gets His Due",
      "New Jersey Black Women Printmakers Shaping the American Narrative",
      "The Bayeux Tapestry's British Museum Debut Is a Hard-Won Triumph",
      "Can triennials reduce their environmental impact?",
    ]) {
      expect(classifyCategory(headline, rthk), headline).toBe("art");
    }
  });

  it("does not take a design publisher off its beat for one work-word", () => {
    // Real Dezeen headline: a shop interior that happens to contain sculptures.
    expect(
      classifyCategory(
        "I IN clads Human Made store in handcrafted Korean celadon tiles. " +
          "Tokyo studio I IN combined tiles with playful animal sculptures in a store.",
        dezeen,
      ),
    ).not.toBe("art");
  });

  it("but a general newsroom still promotes a genuine art story", () => {
    // RTHK has no competing specialism, so the ordinary vocabulary applies.
    expect(
      classifyCategory("Two Renoir paintings worth millions stolen from a museum", rthk),
    ).toBe("art");
  });
});
