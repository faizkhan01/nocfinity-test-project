"use client";

import { useRef } from "react";
import { ArrowIcon } from "@/components/icons";
import { ReviewCard } from "@/components/shop/review-card";
import { SectionHeading } from "@/components/shop/section-heading";
import type { Review } from "@/lib/types";

export function Testimonials({ reviews }: { reviews: Review[] }) {
  const track = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector("li");
    el?.scrollBy({ left: direction * ((card?.clientWidth ?? 400) + 20), behavior: "smooth" });
  };

  if (reviews.length === 0) return null;

  return (
    <section className="pt-[50px] lg:pt-20">
      <div className="container-shop flex items-end justify-between gap-4">
        <SectionHeading className="max-w-[260px] sm:max-w-none">Our happy customers</SectionHeading>
        <div className="flex gap-4 pb-1">
          <button type="button" aria-label="Previous reviews" onClick={() => scroll(-1)}>
            <ArrowIcon direction="left" className="size-6" />
          </button>
          <button type="button" aria-label="Next reviews" onClick={() => scroll(1)}>
            <ArrowIcon className="size-6" />
          </button>
        </div>
      </div>
      <div className="relative mt-6 lg:mt-10">
        <ul ref={track} className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 lg:px-[max(1rem,calc((100vw-1240px)/2))]">
          {reviews.map((review) => (
            <li key={review.id} className="w-[calc(100vw-2rem)] shrink-0 snap-center sm:w-[400px] lg:snap-start">
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
        {/* Blur the partially visible cards at the edges, as in the design. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[max(0px,calc((100vw-1240px)/2))] backdrop-blur-[2px] lg:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[max(0px,calc((100vw-1240px)/2))] backdrop-blur-[2px] lg:block" />
      </div>
    </section>
  );
}
