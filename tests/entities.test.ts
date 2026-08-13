import { describe, expect, it } from "vitest";
import { extractEntities } from "@/lib/ingest/entities";

describe("extractEntities", () => {
  it("maps known companies to tickers", () => {
    const out = extractEntities("Tencent posts higher quarterly revenue");
    expect(out).toContainEqual({ entity: "Tencent", entityType: "company" });
    expect(out).toContainEqual({ entity: "0700.HK", entityType: "ticker" });
  });
  it("recognises Chinese company names", () => {
    const out = extractEntities("騰訊上季本土遊戲收入按年升17%");
    expect(out).toContainEqual({ entity: "0700.HK", entityType: "ticker" });
  });
  it("extracts explicit HK ticker codes", () => {
    const out = extractEntities("The developer (0016) said its contracted sales rose");
    expect(out).toContainEqual({ entity: "0016.HK", entityType: "ticker" });
  });
  it("extracts departments and locations", () => {
    const out = extractEntities("Urban Renewal Authority invites tenders in Kwun Tong");
    expect(out.some((e) => e.entityType === "department")).toBe(true);
    expect(out.some((e) => e.entityType === "location")).toBe(true);
  });
  it("does not invent entities from unrelated text", () => {
    expect(extractEntities("A quiet afternoon with tea")).toEqual([]);
  });
  it("deduplicates repeated mentions", () => {
    const out = extractEntities("Tencent... Tencent again (0700.HK)");
    expect(out.filter((e) => e.entity === "0700.HK")).toHaveLength(1);
  });
});
