import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/format";

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-[6px] text-sm sm:gap-3 sm:text-base", className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-[6px] sm:gap-3">
          {item.href ? (
            <Link href={item.href} className="text-ink/60 hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronRightIcon className="size-3.5 text-ink/60 sm:size-4" />}
        </span>
      ))}
    </nav>
  );
}
