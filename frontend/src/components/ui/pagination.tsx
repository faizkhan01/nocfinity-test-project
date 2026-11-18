import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { cn } from "@/lib/format";

/** Page numbers with ellipses: 1 2 3 ... 8 9 10 around the current page. */
export function pageWindow(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages = new Set([1, 2, last - 1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];

  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) out.push("…");
    out.push(page);
  });

  return out;
}

type Props = { current: number; last: number; href: (page: number) => string; className?: string };

export function Pagination({ current, last, href, className }: Props) {
  if (last <= 1) return null;

  const edge = "inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium sm:h-10 sm:px-[14px]";

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-2", className)}>
      {current > 1 ? (
        <Link href={href(current - 1)} className={edge} rel="prev">
          <ArrowIcon direction="left" className="size-4 sm:size-5" />
          <span className="hidden sm:inline">Previous</span>
        </Link>
      ) : (
        <span className={cn(edge, "pointer-events-none opacity-40")} aria-disabled>
          <ArrowIcon direction="left" className="size-4 sm:size-5" />
          <span className="hidden sm:inline">Previous</span>
        </span>
      )}

      <ol className="flex items-center gap-0.5">
        {pageWindow(current, last).map((page, i) =>
          page === "…" ? (
            <li key={`gap-${i}`} className="grid size-9 place-items-center text-sm text-ink/50 sm:size-10">
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                aria-current={page === current ? "page" : undefined}
                className={cn(
                  "grid size-9 place-items-center rounded-lg text-xs font-medium sm:size-10 sm:text-sm",
                  page === current ? "bg-ink/[0.06] text-ink" : "text-ink/50 hover:bg-ink/[0.03]",
                )}
              >
                {page}
              </Link>
            </li>
          ),
        )}
      </ol>

      {current < last ? (
        <Link href={href(current + 1)} className={edge} rel="next">
          <span className="hidden sm:inline">Next</span>
          <ArrowIcon className="size-4 sm:size-5" />
        </Link>
      ) : (
        <span className={cn(edge, "pointer-events-none opacity-40")} aria-disabled>
          <span className="hidden sm:inline">Next</span>
          <ArrowIcon className="size-4 sm:size-5" />
        </span>
      )}
    </nav>
  );
}
