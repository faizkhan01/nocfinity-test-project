import { VerifiedIcon } from "@/components/icons";
import { cn, formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";
import { Stars } from "./stars";

export function ReviewCard({ review, showDate, className }: { review: Review; showDate?: boolean; className?: string }) {
  return (
    <article className={cn("flex h-full flex-col rounded-[20px] border border-line px-6 py-6 lg:px-8 lg:py-7", className)}>
      <Stars rating={review.rating} className="h-[18px] lg:h-[22.6px]" />
      <div className="mt-3 flex items-center gap-1 lg:mt-[15px]">
        <h3 className="text-base font-bold lg:text-xl">{review.author ?? "Customer"}</h3>
        {review.verified_buyer && <VerifiedIcon className="size-5 lg:size-6" aria-label="Verified buyer" />}
      </div>
      <p className="mt-2 text-sm leading-5 text-ink/60 lg:mt-3 lg:text-base lg:leading-[22px]">&ldquo;{review.comment}&rdquo;</p>
      {showDate && <p className="mt-4 text-sm font-medium text-ink/60 lg:mt-6 lg:text-base">Posted on {formatDate(review.created_at)}</p>}
    </article>
  );
}
