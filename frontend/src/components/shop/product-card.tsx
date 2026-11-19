import Link from "next/link";
import { assetUrl, cn } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";
import { Price } from "./price";
import { RatingLine } from "./stars";
import { MediaImage } from "@/components/ui/media-image";

export function ProductCard({ product, className, priority }: { product: ProductSummary; className?: string; priority?: boolean }) {
  const image = assetUrl(product.image);

  return (
    <Link href={`/product/${product.slug}`} className={cn("group flex flex-col", className)}>
      <div className="relative aspect-[295/298] overflow-hidden rounded-[13.4px] bg-product sm:rounded-card">
        {image && (
          <MediaImage
            src={image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 295px, (min-width: 640px) 33vw, 198px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {!product.in_stock && (
          <span className="absolute left-3 top-3 rounded-pill bg-ink px-3 py-1 text-xs font-medium text-white">Sold out</span>
        )}
      </div>
      <h3 className="mt-[10px] truncate text-base font-bold sm:mt-4 sm:text-xl">{product.name}</h3>
      <RatingLine rating={product.rating_avg} className="mt-1 sm:mt-2" />
      <Price
        final={product.final_price_cents}
        original={product.discount_price_cents ? product.price_cents : null}
        percent={product.discount_percent}
        className="mt-1 sm:mt-2"
      />
    </Link>
  );
}
