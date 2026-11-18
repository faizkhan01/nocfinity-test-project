"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-cart";
import { cn } from "@/lib/format";
import type { Product } from "@/lib/types";

const LIGHT = ["#ffffff", "#f5dd06"];

export function PurchasePanel({ product }: { product: Product }) {
  const [color, setColor] = useState(product.colors[0]?.name ?? null);
  const [size, setSize] = useState(product.sizes[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const add = useAddToCart();

  const maxQuantity = Math.max(1, Math.min(product.stock, 20));
  const soldOut = product.stock_status === "out_of_stock";

  return (
    <>
      {product.colors.length > 0 && (
        <div className="border-b border-line py-6">
          <p className="text-sm text-ink/60 sm:text-base">Select Colors</p>
          <ul className="mt-4 flex flex-wrap gap-3 sm:gap-4">
            {product.colors.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={color === c.name}
                  onClick={() => setColor(c.name)}
                  className="grid size-[37px] place-items-center rounded-full border border-black/20"
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.name && <CheckIcon className={cn("size-4", LIGHT.includes(c.hex.toLowerCase()) ? "text-ink" : "text-white")} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.sizes.length > 0 && (
        <div className="border-b border-line py-6">
          <p className="text-sm text-ink/60 sm:text-base">Choose Size</p>
          <ul className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            {product.sizes.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "rounded-pill px-5 py-[10px] text-sm sm:px-6 sm:py-3 sm:text-base",
                    size === s ? "bg-ink text-white" : "bg-surface text-ink/60 hover:text-ink",
                  )}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.stock_status === "low_stock" && <p className="pt-4 text-sm font-medium text-sale">Only {product.stock} left in stock</p>}

      <div className="flex gap-3 pt-6 sm:gap-5">
        <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} disabled={soldOut} className="w-[110px] shrink-0 sm:w-[170px]" />
        <Button
          size="lg"
          className="flex-1 px-4"
          disabled={soldOut}
          loading={add.isPending}
          onClick={() => add.mutate({ product_id: product.id, quantity, color, size })}
        >
          {soldOut ? "Out of Stock" : "Add to Cart"}
        </Button>
      </div>
    </>
  );
}
