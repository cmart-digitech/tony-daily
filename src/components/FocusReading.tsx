"use client";

import { useState } from "react";

/**
 * Focus Reading (brief §26): a client-side wrapper that, when active, hides
 * blocks marked data-focus-hide and enlarges the reading measure. Sources
 * and provenance are never marked, so they always remain visible.
 */
export default function FocusReading({
  label,
  exitLabel,
  children,
}: {
  label: string;
  exitLabel: string;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={focused ? "focus-reading" : undefined}>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          aria-pressed={focused}
          onClick={() => setFocused((v) => !v)}
          className={`rounded-sm border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            focused
              ? "border-accent text-accent"
              : "border-line-2 text-ink-2 hover:border-accent hover:text-accent"
          }`}
        >
          {focused ? exitLabel : label}
        </button>
      </div>
      {children}
    </div>
  );
}
