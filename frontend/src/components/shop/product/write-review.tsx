"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/field";
import { useCustomer } from "@/hooks/use-customer";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/format";

export function WriteReview({ slug }: { slug: string }) {
  const { data: customer } = useCustomer();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    if (!customer) {
      router.push(`/login?next=${encodeURIComponent(`/product/${slug}`)}`);
      return;
    }
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`products/${slug}/reviews`, { method: "POST", body: { rating, comment } });
      toast.success("Thanks! Your review is live.");
      setOpen(false);
      setComment("");
      await client.invalidateQueries({ queryKey: ["reviews", slug] });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors().comment ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" className="h-10 px-4 sm:h-12 sm:px-5 sm:text-base" onClick={start}>
        Write a Review
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Write a review">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <form onSubmit={submit} className="relative flex w-full max-w-lg flex-col gap-5 rounded-[20px] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Write a review</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <CloseIcon className="size-5 text-ink/50" />
              </button>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Your rating</legend>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(n)}
                    className={cn("text-3xl leading-none", n <= rating ? "text-star" : "text-ink/15")}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <Textarea
              label="Your review"
              name="comment"
              required
              minLength={10}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike? (at least 10 characters)"
            />
            <FormError message={error} />
            <Button type="submit" loading={busy}>
              Submit review
            </Button>
            <p className="text-center text-xs text-ink/50">Only customers whose order for this product was delivered can leave a review.</p>
          </form>
        </div>
      )}
    </>
  );
}
