import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOgImage, fetchOgImages } from "@/lib/ingest/images";

function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  }) as Response & { url: string };
}

function mockFetch(impl: (input: string) => Response) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const res = impl(String(input));
    Object.defineProperty(res, "url", { value: String(input) });
    return res;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOgImage", () => {
  it("extracts a standard og:image", async () => {
    mockFetch(() =>
      htmlResponse(
        `<head><meta property="og:image" content="https://cdn.test/a.jpg"></head>`,
      ),
    );
    expect(await fetchOgImage("https://example.test/story")).toBe("https://cdn.test/a.jpg");
  });

  it("handles reversed attribute order", async () => {
    mockFetch(() =>
      htmlResponse(`<meta content="https://cdn.test/b.jpg" property="og:image">`),
    );
    expect(await fetchOgImage("https://example.test/story")).toBe("https://cdn.test/b.jpg");
  });

  it("falls back to twitter:image", async () => {
    mockFetch(() =>
      htmlResponse(`<meta name="twitter:image" content="https://cdn.test/c.jpg">`),
    );
    expect(await fetchOgImage("https://example.test/story")).toBe("https://cdn.test/c.jpg");
  });

  it("resolves a root-relative image against the page URL", async () => {
    mockFetch(() => htmlResponse(`<meta property="og:image" content="/img/d.jpg">`));
    expect(await fetchOgImage("https://news.test/a/story")).toBe("https://news.test/img/d.jpg");
  });

  it("decodes HTML entities in the URL", async () => {
    mockFetch(() =>
      htmlResponse(`<meta property="og:image" content="https://cdn.test/e.jpg?w=1&amp;h=2">`),
    );
    expect(await fetchOgImage("https://example.test/story")).toBe(
      "https://cdn.test/e.jpg?w=1&h=2",
    );
  });

  it("returns null when the publisher declares no preview image", async () => {
    mockFetch(() => htmlResponse(`<head><title>No preview</title></head>`));
    expect(await fetchOgImage("https://example.test/story")).toBeNull();
  });

  it("ignores data: URIs", async () => {
    mockFetch(() =>
      htmlResponse(`<meta property="og:image" content="data:image/png;base64,AAAA">`),
    );
    expect(await fetchOgImage("https://example.test/story")).toBeNull();
  });

  it("returns null for non-HTML responses", async () => {
    mockFetch(
      () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }) as Response,
    );
    expect(await fetchOgImage("https://example.test/api")).toBeNull();
  });

  it("returns null on an error status", async () => {
    mockFetch(() => new Response("nope", { status: 404 }) as Response);
    expect(await fetchOgImage("https://example.test/missing")).toBeNull();
  });

  it("never throws when the network fails — an image is optional", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    await expect(fetchOgImage("https://example.test/story")).resolves.toBeNull();
  });
});

describe("fetchOgImages", () => {
  it("maps only the articles that yielded an image", async () => {
    mockFetch((url) =>
      url.includes("with-image")
        ? htmlResponse(`<meta property="og:image" content="https://cdn.test/x.jpg">`)
        : htmlResponse("<head></head>"),
    );
    const found = await fetchOgImages([
      { id: 1, url: "https://example.test/with-image" },
      { id: 2, url: "https://example.test/plain" },
    ]);
    expect(found.get(1)).toBe("https://cdn.test/x.jpg");
    expect(found.has(2)).toBe(false);
  });

  it("returns an empty map for no input", async () => {
    expect((await fetchOgImages([])).size).toBe(0);
  });
});
