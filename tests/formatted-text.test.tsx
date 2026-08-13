/**
 * The model is asked for plain prose, but language models emit Markdown
 * habitually. These tests pin the behaviour that the reader never sees raw
 * syntax — using the real output shape observed in production.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FormattedText from "@/components/FormattedText";

const render = (text: string) =>
  renderToStaticMarkup(<FormattedText text={text} />);

describe("FormattedText", () => {
  it("turns a Markdown heading into a styled subheading, not literal hashes", () => {
    const html = render("### 1. Building Management & Smart Mobility");
    expect(html).not.toContain("###");
    expect(html).toContain("<h4");
    expect(html).toContain("Building Management");
  });

  it("renders bold text without showing asterisks", () => {
    const html = render("* **Building Management Ordinance Consultation:** The Government has launched a consultation.");
    expect(html).not.toContain("**");
    expect(html).toContain("<strong");
    expect(html).toContain("Building Management Ordinance Consultation:");
  });

  it("converts bullet lines into a real list", () => {
    const html = render("- First item\n- Second item");
    expect(html).toContain("<ul");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/>\s*-\s/);
  });

  it("converts numbered lines into an ordered list", () => {
    const html = render("1. First\n2. Second");
    expect(html).toContain("<ol");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it("drops horizontal rules", () => {
    const html = render("Intro\n\n---\n\nMore text");
    expect(html).not.toContain("---");
    expect(html).toContain("Intro");
    expect(html).toContain("More text");
  });

  it("preserves citation markers exactly", () => {
    const html = render("Transactions rose 12 per cent in July [1], per RTHK [2].");
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
  });

  it("keeps Traditional Chinese output intact", () => {
    const html = render("**恒生指數**收市跌0.8% [1]。");
    expect(html).toContain("恒生指數");
    expect(html).toContain("收市跌0.8%");
    expect(html).not.toContain("**");
  });

  it("renders plain prose as paragraphs, which is the requested style", () => {
    const html = render("First paragraph.\n\nSecond paragraph.");
    expect((html.match(/<p/g) ?? []).length).toBe(2);
  });

  it("handles the full mixed block seen in production", () => {
    const html = render(
      [
        "Here are the key developments from today's connected news sources:",
        "",
        "---",
        "",
        "### 1. Building Management & Smart Mobility",
        "* **Building Management Ordinance Consultation:** The Hong Kong Government has launched a one-month public consultation [1].",
        "* **Autonomous vehicles:** A trial was approved [2].",
      ].join("\n"),
    );
    for (const raw of ["###", "**", "---"]) expect(html).not.toContain(raw);
    expect(html).toContain("<h4");
    expect(html).toContain("<ul");
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
  });

  it("does not emit raw HTML from model output", () => {
    const html = render("Watch out for <script>alert(1)</script> in text.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an empty string without crashing", () => {
    expect(() => render("")).not.toThrow();
  });
});
