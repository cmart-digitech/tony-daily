"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="hidden md:block"
    >
      <label htmlFor="global-search" className="sr-only">
        {placeholder}
      </label>
      <input
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-52 border-b border-line bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none lg:w-64"
      />
    </form>
  );
}
