"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const ICONS: Record<Theme, string> = { light: "☀", dark: "☾", system: "◐" };
const ORDER: Theme[] = ["light", "dark", "system"];

export default function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    const stored = (localStorage.getItem("td-theme") as Theme | null) ?? initial;
    setTheme(stored);
    applyTheme(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem("td-theme") as Theme | null) ?? "system";
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [initial]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    localStorage.setItem("td-theme", next);
    applyTheme(next);
    fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="rounded-full border border-line px-2.5 py-1 text-sm text-ink-2 transition-colors hover:border-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {ICONS[theme]}
    </button>
  );
}
