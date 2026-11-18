"use client";

import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";
import { SORTS, defaultSort, shopHref, type ShopParams } from "@/lib/shop-filters";

export function SortSelect({ params }: { params: ShopParams }) {
  const router = useRouter();
  const current = params.sort ?? defaultSort(params);
  const options = SORTS.filter((s) => s.value !== "relevance" || params.search);

  return (
    <label className="relative inline-flex items-center gap-1 text-sm text-ink/60 sm:text-base">
      <span className="hidden sm:inline">Sort by:</span>
      <span className="font-medium text-ink">{options.find((s) => s.value === current)?.label ?? "Most Popular"}</span>
      <ChevronDownIcon className="size-4 text-ink" />
      <select
        aria-label="Sort products"
        value={current}
        onChange={(e) => router.push(shopHref(params, { sort: e.target.value, page: undefined }))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
