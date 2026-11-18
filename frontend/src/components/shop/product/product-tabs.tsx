"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDownIcon, FiltersIcon } from "@/components/icons";
import { ReviewCard } from "@/components/shop/review-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/format";
import type { Paginated, Product, Review } from "@/lib/types";
import { WriteReview } from "./write-review";

const TABS = ["Product Details", "Rating & Reviews", "FAQs"] as const;
type Tab = (typeof TABS)[number];

const FAQS = [
  ["How long does delivery take?", "Orders are dispatched within 1–2 business days and usually arrive within 3–5 business days."],
  ["Can I return or exchange an item?", "Yes. Unworn items with tags can be returned within 30 days of delivery for a full refund."],
  ["Is my payment secure?", "Payments are processed by Stripe. We never see or store your full card details."],
  ["Can I cancel my order?", "You can cancel from My Orders until the order starts processing; any payment is refunded to your card."],
];

export function ProductTabs({ product, initialReviews }: { product: Product; initialReviews: Paginated<Review> }) {
  const [tab, setTab] = useState<Tab>("Rating & Reviews");

  return (
    <section className="mt-12 sm:mt-20">
      <div role="tablist" className="grid grid-cols-3 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("-mb-px pb-3 text-base sm:pb-6 sm:text-xl", tab === t ? "border-b-2 border-ink font-medium" : "text-ink/60")}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-5 sm:pt-6">
        {tab === "Product Details" && <Details product={product} />}
        {tab === "Rating & Reviews" && <Reviews product={product} initial={initialReviews} />}
        {tab === "FAQs" && (
          <dl className="divide-y divide-line">
            {FAQS.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="font-bold sm:text-lg">{q}</dt>
                <dd className="mt-2 text-ink/60">{a}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function Details({ product }: { product: Product }) {
  const specs: [string, string][] = [
    ["SKU", product.sku],
    ["Category", product.category?.name ?? "—"],
    ["Style", product.style ? product.style.charAt(0).toUpperCase() + product.style.slice(1) : "—"],
    ["Sizes", product.sizes.join(", ") || "One size"],
    ["Availability", product.stock > 0 ? "In stock" : "Out of stock"],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <p className="whitespace-pre-line leading-7 text-ink/70">{product.description}</p>
      <dl className="rounded-[20px] bg-surface p-6">
        {specs.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm sm:text-base">
            <dt className="text-ink/60">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Reviews({ product, initial }: { product: Product; initial: Paginated<Review> }) {
  const [sort, setSort] = useState<"latest" | "highest" | "lowest">("latest");

  const query = useInfiniteQuery({
    queryKey: ["reviews", product.slug, sort],
    queryFn: ({ pageParam }) => api<Paginated<Review>>(`products/${product.slug}/reviews?sort=${sort}&page=${pageParam}`),
    initialPageParam: 1,
    initialData: sort === "latest" ? { pages: [initial], pageParams: [1] } : undefined,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });

  const reviews = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold sm:text-2xl">
          All Reviews <span className="text-sm font-normal text-ink/60 sm:text-base">({total})</span>
        </h2>
        <div className="flex items-center gap-2 sm:gap-[10px]">
          <span className="hidden size-12 place-items-center rounded-full bg-surface sm:grid" aria-hidden>
            <FiltersIcon className="size-6" />
          </span>
          <label className="relative hidden h-12 items-center gap-6 rounded-pill bg-surface px-5 font-medium sm:inline-flex">
            {sort === "latest" ? "Latest" : sort === "highest" ? "Highest" : "Lowest"}
            <ChevronDownIcon className="size-4" />
            <select
              aria-label="Sort reviews"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
          </label>
          <WriteReview slug={product.slug} />
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-[20px] bg-surface p-8 text-center text-ink/60">No reviews yet. Be the first to share your thoughts.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:mt-8 sm:gap-5 lg:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} showDate />
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="mt-5 flex justify-center sm:mt-9">
          <Button variant="outline" size="lg" className="px-12" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Load More Reviews
          </Button>
        </div>
      )}
    </>
  );
}
