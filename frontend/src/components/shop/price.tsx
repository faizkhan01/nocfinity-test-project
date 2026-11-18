import { cn, money } from "@/lib/format";

type Props = {
  final: number;
  original?: number | null;
  percent?: number | null;
  size?: "card" | "detail" | "line";
  className?: string;
};

const sizes = {
  card: { amount: "text-xl sm:text-2xl", badge: "px-[10px] py-[6px] text-[10px] sm:px-[14px] sm:text-xs", gap: "gap-[5px] sm:gap-[10px]" },
  detail: { amount: "text-2xl sm:text-[32px]", badge: "px-[10px] py-[6px] text-xs sm:px-[14px] sm:text-base", gap: "gap-[10px] sm:gap-3" },
  line: { amount: "text-xl sm:text-2xl", badge: "hidden", gap: "gap-2" },
};

export function Price({ final, original, percent, size = "card", className }: Props) {
  const s = sizes[size];
  const onSale = original != null && original > final;

  return (
    <div className={cn("flex flex-wrap items-center font-bold", s.gap, className)}>
      <span className={s.amount}>{money(final)}</span>
      {onSale && <span className={cn(s.amount, "text-ink/40 line-through")}>{money(original)}</span>}
      {onSale && percent != null && (
        <span className={cn("rounded-pill bg-sale/10 font-medium text-sale", s.badge)}>-{percent}%</span>
      )}
    </div>
  );
}
