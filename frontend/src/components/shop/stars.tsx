import { cn } from "@/lib/format";

const STAR = "M9.24 0 11.86 5.64l6.18.75-4.56 4.23 1.2 6.1-5.44-3.02-5.43 3.02 1.2-6.1L.45 6.39l6.18-.75L9.24 0Z";
const HALF_STAR = "M3.81 16.72 9.24 13.7V0L6.63 5.64.45 6.39l4.56 4.23-1.2 6.1Z";

/** Figma-style rating: only filled stars are drawn, with a half star for .5 ratings. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded - full === 0.5;

  return (
    <span className={cn("inline-flex items-center gap-[5.3px] text-star", className)} role="img" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={i} viewBox="0 0 18.5 18.49" className="h-full w-auto" fill="currentColor" aria-hidden>
          <path d={STAR} />
        </svg>
      ))}
      {half && (
        <svg viewBox="0 0 18.5 18.49" className="h-full w-auto" fill="currentColor" aria-hidden>
          <path d={HALF_STAR} />
        </svg>
      )}
    </span>
  );
}

export function RatingLine({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-[13px]", className)}>
      <Stars rating={rating} className="h-[15px] sm:h-[18.5px]" />
      <span className="text-xs sm:text-sm">
        {rating.toFixed(1)}/<span className="text-ink/60">5</span>
      </span>
    </div>
  );
}
