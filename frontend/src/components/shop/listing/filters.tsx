"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon, FiltersIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/format";
import { listOf, shopHref, type ShopParams } from "@/lib/shop-filters";
import type { Category, Facets } from "@/lib/types";
import { PriceRange } from "./price-range";

type Props = { params: ShopParams; categories: Category[]; facets: Facets };

export function Filters(props: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <aside className="hidden w-[295px] shrink-0 self-start rounded-[20px] border border-line px-6 py-5 lg:block">
        <FilterPanel {...props} />
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-8 place-items-center rounded-full bg-surface lg:hidden"
        aria-label="Open filters"
      >
        <FiltersIcon className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/20" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[20px] bg-white px-5 pb-6 pt-5">
            <FilterPanel {...props} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function FilterPanel({ params, categories, facets, onDone }: Props & { onDone?: () => void }) {
  const router = useRouter();
  const minBound = Math.floor(facets.price.min_cents / 500) * 500;
  const maxBound = Math.max(Math.ceil(facets.price.max_cents / 500) * 500, minBound + 500);

  const [price, setPrice] = useState<[number, number]>([
    Number(params.min_price ?? minBound),
    Number(params.max_price ?? maxBound),
  ]);
  const [colors, setColors] = useState(listOf(params.colors));
  const [sizes, setSizes] = useState(listOf(params.sizes));

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const apply = () => {
    router.push(
      shopHref(params, {
        min_price: price[0] > minBound ? String(price[0]) : undefined,
        max_price: price[1] < maxBound ? String(price[1]) : undefined,
        colors: colors.join(",") || undefined,
        sizes: sizes.join(",") || undefined,
        page: undefined,
      }),
    );
    onDone?.();
  };

  const subcategories = categories.flatMap((parent) => parent.children ?? []);
  const styles = listOf(params.styles);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Filters</h2>
        {onDone ? (
          <button type="button" onClick={onDone} aria-label="Close filters">
            <CloseIcon className="size-5 text-ink/40" />
          </button>
        ) : (
          <FiltersIcon className="size-6 text-ink/40" />
        )}
      </div>
      <hr className="border-line" />

      <ul className="flex flex-col gap-3 text-base text-ink/60">
        {subcategories.map((category) => (
          <li key={category.id}>
            <Link
              href={shopHref(params, { category: params.category === category.slug ? undefined : category.slug, page: undefined })}
              onClick={onDone}
              className={cn("flex items-center justify-between hover:text-ink", params.category === category.slug && "font-medium text-ink")}
            >
              {category.name}
              <ChevronRightIcon className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      <hr className="border-line" />

      <Section title="Price">
        <PriceRange min={minBound} max={maxBound} value={price} onChange={setPrice} />
      </Section>
      <hr className="border-line" />

      <Section title="Colors">
        <ul className="flex flex-wrap gap-[15px] lg:gap-4">
          {facets.colors.map((color) => {
            const active = colors.includes(color.name);
            const light = ["#ffffff", "#f5dd06"].includes(color.hex.toLowerCase());
            return (
              <li key={color.name}>
                <button
                  type="button"
                  title={color.name}
                  aria-label={color.name}
                  aria-pressed={active}
                  onClick={() => setColors(toggle(colors, color.name))}
                  className="grid size-[37px] place-items-center rounded-full border-2 border-black/20"
                  style={{ backgroundColor: color.hex }}
                >
                  {active && <CheckIcon className={cn("size-4", light ? "text-ink" : "text-white")} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
      <hr className="border-line" />

      <Section title="Size">
        <ul className="flex flex-wrap gap-2">
          {facets.sizes.map((size) => {
            const active = sizes.includes(size);
            return (
              <li key={size}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSizes(toggle(sizes, size))}
                  className={cn("rounded-pill px-5 py-2.5 text-sm", active ? "bg-ink text-white" : "bg-surface text-ink/60 hover:text-ink")}
                >
                  {size}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
      <hr className="border-line" />

      <Section title="Dress Style">
        <ul className="flex flex-col gap-3 text-base text-ink/60">
          {facets.styles.map((style) => {
            const active = styles.includes(style);
            return (
              <li key={style}>
                <Link
                  href={shopHref(params, { styles: active ? undefined : style, page: undefined })}
                  onClick={onDone}
                  className={cn("flex items-center justify-between capitalize hover:text-ink", active && "font-medium text-ink")}
                >
                  {style}
                  <ChevronRightIcon className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Button onClick={apply} className="w-full">
        Apply Filter
      </Button>
      <Link href="/shop" onClick={onDone} className="-mt-2 text-center text-sm text-ink/60 underline hover:text-ink">
        Clear all filters
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="flex flex-col gap-5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{title}</h3>
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && children}
    </section>
  );
}
