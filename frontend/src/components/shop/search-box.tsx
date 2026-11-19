"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api/client";
import { assetUrl, cn, money } from "@/lib/format";
import { pickParams, shopHref } from "@/lib/shop-filters";
import type { Paginated, ProductSummary } from "@/lib/types";
import { MediaImage } from "@/components/ui/media-image";

const MIN_CHARS = 2;
const SUGGESTIONS = 6;

/**
 * Search as you type: on the shop page the listing itself updates; elsewhere a dropdown
 * shows the top matches. Enter still opens the full results.
 */
export function SearchBox({ className, autoFocus, onSubmitted }: { className?: string; autoFocus?: boolean; onSubmitted?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onShop = pathname === "/shop";
  const urlTerm = params.get("search") ?? "";

  const [term, setTerm] = useState(urlTerm);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounced(term.trim());
  const rootRef = useRef<HTMLFormElement>(null);
  const pushedRef = useRef(urlTerm);
  const listId = useId();

  // Follow URL changes made elsewhere (e.g. "Clear all filters"), but never our own, which would undo fresh keystrokes.
  useEffect(() => {
    if (onShop && urlTerm !== pushedRef.current) {
      pushedRef.current = urlTerm;
      setTerm(urlTerm);
    }
  }, [onShop, urlTerm]);

  // On the shop page, typing filters the listing directly, keeping the other filters.
  useEffect(() => {
    if (!onShop || debounced === urlTerm || (debounced.length > 0 && debounced.length < MIN_CHARS)) return;
    const current = pickParams(Object.fromEntries(params.entries()));
    pushedRef.current = debounced;
    router.replace(
      shopHref(current, {
        search: debounced || undefined,
        page: undefined,
        // "Best Match" only exists while searching.
        sort: !debounced && current.sort === "relevance" ? undefined : current.sort,
      }),
      { scroll: false },
    );
  }, [debounced, onShop, urlTerm, params, router]);

  const enabled = !onShop && debounced.length >= MIN_CHARS;
  const { data, isFetching } = useQuery({
    queryKey: ["search-suggestions", debounced],
    queryFn: ({ signal }) =>
      api<Paginated<ProductSummary>>(`products?${new URLSearchParams({ search: debounced, per_page: String(SUGGESTIONS) })}`, { signal }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const results = enabled ? (data?.data ?? []) : [];
  const total = data?.meta.total ?? 0;
  // Hide immediately when the text gets short, instead of waiting for the debounce.
  const showList = open && enabled && term.trim().length >= MIN_CHARS;

  useEffect(() => setActive(-1), [debounced]);

  useEffect(() => {
    const close = (event: MouseEvent) => rootRef.current && !rootRef.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const finish = () => {
    setOpen(false);
    onSubmitted?.();
  };

  const goToResults = () => {
    const query = term.trim();
    router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
    finish();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Chrome's native Escape clears a search field; close the list instead and keep the text.
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!showList || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      router.push(`/product/${results[active].slug}`);
      finish();
    }
  };

  return (
    <form
      ref={rootRef}
      role="search"
      className={cn("relative flex items-center gap-3 rounded-pill bg-surface px-4 py-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        goToResults();
      }}
    >
      <SearchIcon className="size-6 shrink-0 text-ink/40" />
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={term}
        autoFocus={autoFocus}
        maxLength={100}
        autoComplete="off"
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search for products..."
        aria-label="Search for products"
        className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40 sm:text-base"
      />
      {isFetching && enabled && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" aria-hidden />}

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-[20px] border border-line bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink/60" role="status">
              {isFetching ? "Searching…" : `No products found for “${debounced}”.`}
            </p>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label="Matching products" className="max-h-[60vh] overflow-y-auto py-2">
                {results.map((product, i) => (
                  <li key={product.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={finish}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex items-center gap-3 px-4 py-2", i === active && "bg-surface")}
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-product">
                        {product.image && <MediaImage src={assetUrl(product.image)!} alt="" fill sizes="48px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          <Highlight text={product.name} term={debounced} />
                        </span>
                        <span className="text-xs text-ink/50">{product.category?.name}</span>
                      </span>
                      <span className="text-sm font-bold">{money(product.final_price_cents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="submit" className="block w-full border-t border-line px-5 py-3 text-left text-sm font-medium hover:bg-surface">
                See all {total} result{total === 1 ? "" : "s"} for “{debounced}” →
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}

/** Bolds the typed text inside a result name (rendered as text, never as HTML). */
function Highlight({ text, term }: { text: string; term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (!term || index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <strong className="font-bold">{text.slice(index, index + term.length)}</strong>
      {text.slice(index + term.length)}
    </>
  );
}
