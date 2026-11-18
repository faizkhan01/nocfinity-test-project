"use client";

import { money } from "@/lib/format";

type Props = { min: number; max: number; value: [number, number]; onChange: (value: [number, number]) => void };

/** Two overlaid native range inputs: keyboard and screen-reader accessible without a slider library. */
export function PriceRange({ min, max, value, onChange }: Props) {
  const span = Math.max(max - min, 1);
  const left = ((value[0] - min) / span) * 100;
  const right = ((value[1] - min) / span) * 100;
  const step = 500;

  const thumb =
    "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink";

  return (
    <div className="px-2.5">
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${left}%`, right: `${100 - right}%` }} />
        <input
          type="range"
          aria-label="Minimum price"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onChange([Math.min(Number(e.target.value), value[1] - step), value[1]])}
          className={thumb}
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0] + step)])}
          className={thumb}
        />
      </div>
      <div className="relative mt-1 h-5 text-sm font-medium">
        <span className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>
          {money(value[0])}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${right}%` }}>
          {money(value[1])}
        </span>
      </div>
    </div>
  );
}
