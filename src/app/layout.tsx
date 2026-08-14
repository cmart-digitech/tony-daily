import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import MarketStrip from "@/components/MarketStrip";
import MiniPlayer from "@/components/MiniPlayer";
import SetupRequired from "@/components/SetupRequired";
import { getPreferences } from "@/lib/prefs";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Tony Daily",
  description: "Tony's personal market + built environment intelligence terminal",
};

export const dynamic = "force-dynamic";

/** Applies the stored theme before first paint to avoid a flash. */
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem("td-theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A deployment with no reachable database should explain itself rather
  // than surfacing an opaque 500 from every route.
  let prefs: Awaited<ReturnType<typeof getPreferences>>;
  try {
    prefs = await getPreferences();
  } catch (err) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-bg text-ink antialiased">
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <SetupRequired
            detail={err instanceof Error ? err.message : "Unknown database error."}
          />
        </body>
      </html>
    );
  }
  const lang = prefs.language;
  const comfort = prefs.comfort;
  return (
    <html
      lang={lang === "zh" ? "zh-HK" : "en"}
      suppressHydrationWarning
      data-textsize={comfort.textSize !== "normal" ? comfort.textSize : undefined}
      data-spacing={comfort.lineSpacing !== "comfortable" ? comfort.lineSpacing : undefined}
      data-density={comfort.density !== "comfortable" ? comfort.density : undefined}
      data-contrast={comfort.contrast !== "standard" ? comfort.contrast : undefined}
      data-motion={comfort.motion !== "standard" ? comfort.motion : undefined}
      data-comfort={comfort.comfortMode ? "on" : undefined}
    >
      <body className="min-h-screen bg-bg text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Keyboard users land here first and can jump past the nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-accent focus:bg-elevated focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
        >
          {lang === "zh" ? "跳至主要內容" : "Skip to main content"}
        </a>
        {prefs.onboarded && (
          <>
            <Header lang={lang} theme={prefs.theme} />
            <MarketStrip />
          </>
        )}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        {prefs.onboarded && <MiniPlayer />}
        {prefs.onboarded && (
          <footer className="mt-16 border-t border-line">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
              <p className="text-xs leading-relaxed text-ink-3">
                {t(lang, "disclaimer")}
              </p>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
