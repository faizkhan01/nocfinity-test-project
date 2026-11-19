"use client";

import { useState } from "react";
import { assetUrl, cn } from "@/lib/format";
import type { Product } from "@/lib/types";
import { MediaImage } from "@/components/ui/media-image";
import { ZoomImage } from "./zoom-image";

export function Gallery({ product }: { product: Product }) {
  const images = product.images.length ? product.images : [{ id: 0, url: product.image ?? "", alt: product.name }];
  const [active, setActive] = useState(0);
  const current = assetUrl(images[active]?.url);

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-[14px]">
      {current ? (
        <ZoomImage
          src={current}
          alt={images[active].alt}
          className="aspect-[358/290] w-full rounded-[20px] bg-product lg:aspect-[444/530] lg:w-[444px]"
        />
      ) : (
        <div className="aspect-[358/290] w-full rounded-[20px] bg-product lg:aspect-[444/530] lg:w-[444px]" />
      )}
      {images.length > 1 && (
        <ul className="grid grid-cols-3 gap-3 lg:flex lg:w-[152px] lg:flex-col lg:gap-[14px]">
          {images.map((image, i) => {
            const src = assetUrl(image.url);
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === active}
                  className={cn(
                    "relative block aspect-[111/106] w-full overflow-hidden rounded-[20px] bg-product lg:aspect-[152/167]",
                    i === active && "ring-1 ring-ink",
                  )}
                >
                  {src && <MediaImage src={src} alt="" fill sizes="152px" className="object-cover" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
