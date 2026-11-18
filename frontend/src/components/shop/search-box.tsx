"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/format";

export function SearchBox({ className, autoFocus, onSubmitted }: { className?: string; autoFocus?: boolean; onSubmitted?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("search") ?? "");

  return (
    <form
      role="search"
      className={cn("flex items-center gap-3 rounded-pill bg-surface px-4 py-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const query = term.trim();
        router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
        onSubmitted?.();
      }}
    >
      <SearchIcon className="size-6 shrink-0 text-ink/40" />
      <input
        type="search"
        value={term}
        autoFocus={autoFocus}
        maxLength={100}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search for products..."
        aria-label="Search for products"
        className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40 sm:text-base"
      />
    </form>
  );
}
