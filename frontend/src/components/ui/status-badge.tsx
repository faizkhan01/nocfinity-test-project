import { cn } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  paid: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300",
  shipped: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
};

const LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-pill px-3 py-1 text-xs font-medium", STYLES[status], className)}>{LABELS[status]}</span>;
}
