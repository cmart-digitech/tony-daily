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
