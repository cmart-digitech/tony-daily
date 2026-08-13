import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import MarketStrip from "@/components/MarketStrip";
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
  return (
    <html lang={lang === "zh" ? "zh-HK" : "en"} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {prefs.onboarded && (
          <>
            <Header lang={lang} theme={prefs.theme} />
            <MarketStrip />
          </>
        )}
        <main id="main">{children}</main>
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
