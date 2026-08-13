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
