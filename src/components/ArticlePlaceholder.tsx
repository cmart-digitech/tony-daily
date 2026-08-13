/**
 * The typographic placeholder used when no authentic image exists.
 *
 * The product rule is that an unavailable photograph beats a misleading one,
 * so nothing here pretends to depict the story. Instead of an apologetic
 * "image unavailable" box, the card fills the same aspect ratio with a
 * deliberate editorial composition: the publisher, the section, and a quiet
 * architectural rule drawing derived from the article id — so the grid stays
 * even and the page reads as designed rather than broken.
 */

const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  markets: { en: "Markets", zh: "市場" },
  property: { en: "Property", zh: "地產" },
  architecture: { en: "Architecture", zh: "建築" },
  infrastructure: { en: "Infrastructure", zh: "基建" },
  government: { en: "Government", zh: "政府" },
  general: { en: "News", zh: "新聞" },
};

/** Deterministic, so a story always renders the same composition. */
function hash(seed: number): number {
  let x = (seed + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

export default function ArticlePlaceholder({
  seed,
  sourceName,
  category,
  lang,
  className = "",
}: {
  seed: number;
  sourceName: string;
  category: string;
  lang: "en" | "zh";
  className?: string;
}) {
  const h = hash(seed);
  // Three quiet variants keep a grid from looking mechanically repetitive.
  const variant = h % 3;
  const label = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.general;

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden border border-line bg-subtle ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full text-line-2"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        fill="none"
      >
        {variant === 0 && (
          <>
            <line x1="0" y1="210" x2="400" y2="210" stroke="currentColor" strokeWidth="1" />
            <line x1="300" y1="0" x2="300" y2="300" stroke="currentColor" strokeWidth="1" />
            <rect x="300" y="210" width="100" height="90" fill="currentColor" opacity="0.16" />
          </>
        )}
        {variant === 1 && (
          <>
            <line x1="0" y1="90" x2="400" y2="90" stroke="currentColor" strokeWidth="1" />
            <line x1="120" y1="90" x2="120" y2="300" stroke="currentColor" strokeWidth="1" />
            <line x1="260" y1="90" x2="260" y2="300" stroke="currentColor" strokeWidth="1" />
            <rect x="120" y="90" width="140" height="60" fill="currentColor" opacity="0.14" />
          </>
        )}
        {variant === 2 && (
          <>
            <line x1="0" y1="150" x2="400" y2="150" stroke="currentColor" strokeWidth="1" />
            <line x1="0" y1="151" x2="220" y2="151" stroke="currentColor" strokeWidth="3" />
            <circle cx="330" cy="90" r="46" stroke="currentColor" strokeWidth="1" />
          </>
        )}
      </svg>

      <div className="relative p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
          {lang === "zh" ? label.zh : label.en}
        </span>
      </div>
      <div className="relative p-4">
        <span className="font-serif text-lg leading-tight text-ink-2">{sourceName}</span>
      </div>
    </div>
  );
}
