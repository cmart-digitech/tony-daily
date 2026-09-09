"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FormattedText from "./FormattedText";
import ListenButton, { speechLang } from "./ListenButton";
import MicButton from "./MicButton";

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

interface ConversationMeta {
  id: number;
  title: string | null;
  createdAt: number;
  updatedAt: number | null;
  pinned: boolean;
  archived: boolean;
  language: string | null;
  messageCount: number;
}

/**
 * Ask Tony Daily — persistent intelligence workspace (brief §20–22).
 * Conversation library with search/pin/archive/rename/delete, microphone
 * input, and spoken answers. Every answer still comes from the grounded
 * retrieval pipeline with visible citations.
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
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async (q = "", archived = false) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (archived) params.set("archived", "1");
      const res = await fetch(`/api/conversations?${params}`);
      const data = await res.json();
      if (data.ok) setConversations(data.conversations);
    } catch {
      /* library list is non-critical */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const openConversation = async (id: number) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!data.ok) return;
      setConversationId(id);
      setMessages(
        (data.messages as { role: "user" | "assistant"; content: string; citations: string | null }[]).map(
          (m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations ? (JSON.parse(m.citations) as Citation[]) : undefined,
          }),
        ),
      );
      setShowLibrary(false);
      setError(null);
    } catch {
      setError("Could not open that conversation.");
    }
  };

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setShowLibrary(false);
  };

  const mutateConversation = async (id: number, patch: Record<string, unknown>) => {
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadConversations(librarySearch, showArchived);
  };

  const deleteConversation = async (id: number) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (conversationId === id) newConversation();
    loadConversations(librarySearch, showArchived);
  };

  const searchLibrary = (q: string) => {
    setLibrarySearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadConversations(q, showArchived), 300);
  };

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
        loadConversations(librarySearch, showArchived);
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

  const fmtDate = (ts: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      day: "numeric",
      month: "short",
    }).format(new Date(ts));

  const library = (
    <aside
      className={`${showLibrary ? "block" : "hidden"} w-full shrink-0 border-line md:block md:w-72 md:border-r md:pr-4`}
      aria-label="Conversation library"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={newConversation}
          className="flex-1 border border-line-2 px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          + New conversation
        </button>
      </div>
      <input
        type="search"
        value={librarySearch}
        onChange={(e) => searchLibrary(e.target.value)}
        placeholder="Search conversations…"
        aria-label="Search conversations"
        className="mb-2 w-full border-b border-line bg-transparent px-1 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={() => {
          const next = !showArchived;
          setShowArchived(next);
          loadConversations(librarySearch, next);
        }}
        className="mb-3 text-[11px] uppercase tracking-wider text-ink-3 hover:text-accent"
      >
        {showArchived ? "← Active" : "Archived →"}
      </button>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto md:max-h-[62vh]">
        {conversations.map((c) => (
          <li
            key={c.id}
            className={`group border-l-2 py-1.5 pl-3 pr-1 ${
              c.id === conversationId ? "border-accent" : "border-transparent"
            }`}
          >
            {renamingId === c.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameText.trim()) mutateConversation(c.id, { title: renameText.trim() });
                  setRenamingId(null);
                }}
              >
                <input
                  autoFocus
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => setRenamingId(null)}
                  aria-label="Rename conversation"
                  className="w-full border-b border-accent bg-transparent text-sm text-ink focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="block w-full truncate text-left text-sm text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                title={c.title ?? "Untitled"}
              >
                {c.pinned && <span aria-label="Pinned">📌 </span>}
                {c.title ?? "Untitled"}
              </button>
            )}
            <div className="flex items-center gap-2 text-[10px] text-ink-3">
              <span>
                {fmtDate(c.updatedAt ?? c.createdAt)} · {c.messageCount}
              </span>
              <span className="hidden gap-1.5 group-hover:flex">
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameText(c.title ?? "");
                  }}
                  className="hover:text-accent"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => mutateConversation(c.id, { pinned: !c.pinned })}
                  className="hover:text-accent"
                >
                  {c.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => mutateConversation(c.id, { archived: !c.archived })}
                  className="hover:text-accent"
                >
                  {c.archived ? "Restore" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversation(c.id)}
                  className="hover:text-down"
                >
                  Delete
                </button>
              </span>
            </div>
          </li>
        ))}
        {conversations.length === 0 && (
          <li className="py-2 text-sm text-ink-3">No conversations yet.</li>
        )}
      </ul>
    </aside>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row">
      {library}
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setShowLibrary((v) => !v)}
          className="mb-2 self-start text-[11px] uppercase tracking-wider text-ink-3 hover:text-accent md:hidden"
        >
          {showLibrary ? "Hide conversations" : "Conversations"}
        </button>

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
                <FormattedText
                  text={m.content}
                  className="border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-ink"
                />
                <div className="mt-2 pl-4">
                  <ListenButton
                    segments={[{ text: m.content.replace(/\[\d+\]/g, ""), lang: speechLang(m.content) }]}
                  />
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
                            {c.publishedAt ? ` · ${fmtDate(c.publishedAt)}` : ""}
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
          className="flex items-center gap-2 border-t border-line pt-4"
        >
          <MicButton
            disabled={busy}
            onTranscript={(text) => setInput(text)}
          />
          <label htmlFor="chat-input" className="sr-only">
            {labels.placeholder}
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={labels.placeholder}
            className="min-w-0 flex-1 border border-line-2 bg-elevated px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
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
    </div>
  );
}
