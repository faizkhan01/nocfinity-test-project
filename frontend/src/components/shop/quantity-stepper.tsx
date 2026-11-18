"use client";

import { MinusIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/format";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
};

export function QuantityStepper({ value, onChange, min = 1, max = 20, disabled, size = "md", className }: Props) {
  const box = size === "md" ? "h-11 sm:h-[52px] px-4 sm:px-5 gap-5 sm:gap-10" : "h-8 sm:h-11 px-[14px] sm:px-5 gap-3 sm:gap-5";
  const icon = size === "md" ? "size-5 sm:size-6" : "size-4 sm:size-5";

  return (
    <div className={cn("inline-flex items-center justify-between rounded-pill bg-surface", box, className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="disabled:opacity-30"
      >
        <MinusIcon className={icon} />
      </button>
      <span className={cn("min-w-4 text-center font-medium", size === "sm" ? "text-sm" : "text-base")} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className="disabled:opacity-30"
      >
        <PlusIcon className={icon} />
      </button>
    </div>
  );
}
