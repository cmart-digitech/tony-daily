import Link from "next/link";
import { t, type UiLanguage } from "@/lib/i18n";
import LanguageToggle from "./LanguageToggle";
import SearchBox from "./SearchBox";
import ThemeToggle from "./ThemeToggle";

export default function Header({
  lang,
  theme,
}: {
  lang: UiLanguage;
  theme: "light" | "dark" | "system";
}) {
  const nav = [
    { href: "/", label: t(lang, "today") },
    { href: "/markets", label: t(lang, "markets") },
    { href: "/property", label: t(lang, "property") },
    { href: "/architecture", label: t(lang, "architecture") },
    { href: "/art", label: t(lang, "art") },
    { href: "/video", label: t(lang, "video") },
    { href: "/watchlist", label: t(lang, "watchlist") },
    { href: "/audio", label: t(lang, "audio") },
    { href: "/saved", label: t(lang, "saved") },
  ];
  return (
    <header className="border-b border-line bg-bg/95 backdrop-blur supports-backdrop-filter:bg-bg/80 sticky top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-xl font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          THE<span className="text-accent">·</span>DAILY
        </Link>
        {/* Ten items need the full max-w-7xl row. Adding VIDEO took them to
            759px against ~700px available and wrapped "Ask The Daily" onto
            three lines; the tighter gap and narrower search box (SearchBox,
            xl:w-36) and tracking-wide make room at 1280px and up (xl), with
            margin left for a 17px Windows scrollbar; nowrap stops a label
            breaking mid-phrase.
            Below xl there is no room at all, so the scrolling row is used. */}
        <nav aria-label="Main" className="hidden flex-1 xl:block">
          <ul className="flex items-center gap-3">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="whitespace-nowrap text-[13px] uppercase tracking-wide text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/chat"
                className="whitespace-nowrap text-[13px] uppercase tracking-wide text-accent transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {t(lang, "askTonyDaily")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchBox placeholder={t(lang, "searchEverything")} />
          <LanguageToggle initial={lang} />
          <ThemeToggle initial={theme} />
          <Link
            href="/settings"
            aria-label={t(lang, "settings")}
            title={t(lang, "settings")}
            className="rounded-full border border-line px-2.5 py-1 text-sm text-ink-2 hover:border-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            ⚙
          </Link>
        </div>
      </div>
      {/* Compact nav for mobile, tablet and smaller laptops */}
      <nav aria-label="Main mobile" className="xl:hidden">
        <ul className="flex items-center gap-5 overflow-x-auto border-t border-line px-4 py-2 sm:px-6">
          {[...nav, { href: "/chat", label: t(lang, "askTonyDaily") }].map((n) => (
            <li key={n.href} className="shrink-0">
              <Link
                href={n.href}
                className={`text-[13px] uppercase tracking-wider transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent ${
                  n.href === "/chat" ? "text-accent" : "text-ink-2"
                }`}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
