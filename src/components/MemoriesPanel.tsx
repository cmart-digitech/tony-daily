"use client";

import { useCallback, useEffect, useState } from "react";

interface Memory {
  id: number;
  content: string;
  category: string | null;
  updatedAt: number;
}

/**
 * What Tony Daily Remembers (brief §23): full inspect/add/edit/delete over
 * the assistant's saved preferences. Nothing else ever writes here.
 */
export default function MemoriesPanel({ zh }: { zh: boolean }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/memories");
    const data = await res.json();
    if (data.ok) setMemories(data.memories);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim() }),
    });
    setDraft("");
    load();
  };

  const saveEdit = async (id: number) => {
    if (editText.trim()) {
      await fetch("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content: editText.trim() }),
      });
    }
    setEditingId(null);
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/memories?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm text-ink-2">
        {zh
          ? "呢度嘅內容係你明確要求 The Daily 記住嘅偏好，只會影響回答方式，唔會當成事實。"
          : "These are preferences you have explicitly asked The Daily to remember. They shape how the assistant answers — they are never treated as facts about the world."}
      </p>
      <form onSubmit={add} className="mb-5 flex gap-2">
        <label htmlFor="memory-draft" className="sr-only">
          {zh ? "新增記憶" : "Add a memory"}
        </label>
        <input
          id="memory-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder={
            zh ? "例如：我最關注新鴻基同埋長實" : "e.g. I follow Sun Hung Kai and CK Asset most closely"
          }
          className="min-w-0 flex-1 border border-line-2 bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="border border-line-2 px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {zh ? "記住" : "Remember"}
        </button>
      </form>
      {memories.length === 0 ? (
        <p className="text-sm text-ink-3">
          {zh ? "暫時無任何已儲存嘅記憶。" : "Nothing is remembered yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start gap-3 py-3">
              {editingId === m.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(m.id);
                  }}
                >
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={500}
                    aria-label={zh ? "編輯記憶" : "Edit memory"}
                    className="min-w-0 flex-1 border-b border-accent bg-transparent text-sm text-ink focus:outline-none"
                  />
                  <button type="submit" className="text-xs text-accent">
                    {zh ? "儲存" : "Save"}
                  </button>
                </form>
              ) : (
                <>
                  <p className="min-w-0 flex-1 text-sm text-ink">{m.content}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditText(m.content);
                    }}
                    className="text-xs text-ink-3 hover:text-accent"
                  >
                    {zh ? "編輯" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="text-xs text-ink-3 hover:text-down"
                  >
                    {zh ? "刪除" : "Delete"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
