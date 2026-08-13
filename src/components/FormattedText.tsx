import type { ReactNode } from "react";

/**
 * Renders model output as clean editorial typography.
 *
 * The system prompt asks for plain prose, but language models emit Markdown
 * habitually. Rather than showing raw `###` and `**` to the reader, this
 * converts the common constructs into typography that matches the rest of
 * the product. Everything is built as React elements — model output is never
 * injected as HTML.
 *
 * Citation markers like [1] are left untouched.
 */

/** Inline: **bold**, *italic*, `code`. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ kind: "list", ...list });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Horizontal rules add nothing here; the layout already separates blocks.
    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: heading[1].replace(/\*\*/g, "").trim() });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { items: [], ordered: false };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { items: [], ordered: true };
      }
      list.items.push(numbered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export default function FormattedText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h4
              key={i}
              className="pt-1 text-xs font-semibold uppercase tracking-widest text-ink-3"
            >
              {block.text}
            </h4>
          );
        }
        if (block.kind === "list") {
          const items = block.items.map((item, j) => (
            <li key={j} className="pl-1">
              {renderInline(item, `b${i}-l${j}`)}
            </li>
          ));
          return block.ordered ? (
            <ol key={i} className="list-decimal space-y-1.5 pl-5">
              {items}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-ink-3">
              {items}
            </ul>
          );
        }
        return <p key={i}>{renderInline(block.text, `b${i}`)}</p>;
      })}
    </div>
  );
}
