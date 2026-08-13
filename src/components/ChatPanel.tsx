"use client";

import { useEffect, useRef, useState } from "react";

interface Citation {
  n: number;
  articleId: number;
  title: string;
  source: string;
  url: string;
  publishedAt: number | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

/**
 * Ask Tony Daily. Every answer is produced server-side from retrieved
 * indexed sources + labelled market data, with clickable citations.
 */
export default function ChatPanel({
  aiConfigured,
  initialQuestion,
  labels,
}: {
  aiConfigured: boolean;
  initialQuestion?: string;
  labels: { placeholder: string; send: string; notConfigured: string; sources: string };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await res.json();
      if (data.ok) {
        setConversationId(data.conversationId);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.text, citations: data.citations },
        ]);
      } else {
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const SUGGESTIONS = [
    "What's important today?",
    "今日香港地產有咩重要新聞？",
    "What happened to my watchlist today?",
    "Give me the architecture news only.",
  ];

  if (!aiConfigured) {
    return (
      <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
        {labels.notConfigured}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-6">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-line-2 px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] sm:max-w-[70%]">
              <p className="bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-bg">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="max-w-[95%] sm:max-w-[85%]">
              <div className="whitespace-pre-wrap border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-ink">
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pl-4">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-3">
                    {labels.sources}
                  </p>
                  <ul className="space-y-1">
                    {m.citations.map((c) => (
                      <li key={c.n} className="text-xs text-ink-2">
                        <span className="font-mono text-ink-3">[{c.n}]</span>{" "}
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-line-2 underline-offset-2 hover:text-accent"
                        >
                          {c.title}
                        </a>{" "}
                        <span className="text-ink-3">
                          — {c.source}
                          {c.publishedAt
                            ? ` · ${new Intl.DateTimeFormat("en-GB", {
                                timeZone: "Asia/Hong_Kong",
                                day: "numeric",
                                month: "short",
                              }).format(new Date(c.publishedAt))}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="max-w-[60%] space-y-2 pl-4">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </div>
        )}
        {error && <p className="text-sm text-down">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-line pt-4"
      >
        <label htmlFor="chat-input" className="sr-only">
          {labels.placeholder}
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 border border-line-2 bg-elevated px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-ink px-5 py-2.5 text-sm text-bg transition-opacity hover:opacity-85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {labels.send}
        </button>
      </form>
    </div>
  );
}
