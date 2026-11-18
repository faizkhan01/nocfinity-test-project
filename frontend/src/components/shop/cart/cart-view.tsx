"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowIcon, TrashIcon } from "@/components/icons";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { Button, ButtonLink } from "@/components/ui/button";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/hooks/use-cart";
import { useCustomer } from "@/hooks/use-customer";
import { assetUrl, money } from "@/lib/format";
import type { CartItem } from "@/lib/types";
import { OrderSummary } from "./order-summary";

export function CartView() {
  const { data: cart, isLoading } = useCart();
  const { data: customer } = useCustomer();
  const router = useRouter();

  if (isLoading) {
    return <div className="mt-6 h-[420px] animate-pulse rounded-[20px] bg-surface" aria-busy="true" />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center gap-4 rounded-[20px] bg-surface px-6 py-16 text-center">
        <p className="text-xl font-bold">Your cart is empty</p>
        <p className="text-ink/60">Find something you love and it will show up here.</p>
        <ButtonLink href="/shop">Start shopping</ButtonLink>
      </div>
    );
  }

  const checkout = () => router.push(customer ? "/checkout" : "/login?next=/checkout");

  return (
    <div className="mt-5 grid items-start gap-5 sm:mt-6 lg:grid-cols-[715px_1fr]">
      <ul className="rounded-[20px] border border-line px-[14px] py-[14px] sm:px-6 sm:py-5">
        {cart.items.map((item, i) => (
          <li key={item.id}>
            {i > 0 && <hr className="my-4 border-line sm:my-6" />}
            <Line item={item} />
          </li>
        ))}
      </ul>

      <OrderSummary cart={cart}>
        {cart.has_issues && (
          <p className="mt-4 rounded-2xl bg-sale/10 px-4 py-3 text-sm text-sale">Some items need your attention before you can check out.</p>
        )}
        <Button size="lg" className="mt-6 h-[54px] w-full sm:h-[60px]" disabled={cart.has_issues} onClick={checkout}>
          Go to Checkout <ArrowIcon className="size-5 sm:size-6" />
        </Button>
        {!customer && <p className="mt-3 text-center text-sm text-ink/60">You&apos;ll sign in or create an account before paying; your cart is kept.</p>}
      </OrderSummary>
    </div>
  );
}

function Line({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const image = assetUrl(item.product.image);
  const maxQuantity = Math.max(1, Math.min(item.product.stock, 20));

  return (
    <div className="flex gap-[14px] sm:gap-4">
      <Link href={`/product/${item.product.slug}`} className="relative size-[99px] shrink-0 overflow-hidden rounded-[8.66px] bg-product sm:size-[124px]">
        {image && <Image src={image} alt={item.product.name} fill sizes="124px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/product/${item.product.slug}`} className="truncate text-base font-bold hover:underline sm:text-xl">
            {item.product.name}
          </Link>
          <button type="button" aria-label={`Remove ${item.product.name}`} onClick={() => remove.mutate(item.id)} disabled={remove.isPending}>
            <TrashIcon className="size-4 text-sale sm:size-6" />
          </button>
        </div>
        {item.size && (
          <p className="mt-0.5 text-xs sm:text-sm">
            Size: <span className="text-ink/60">{item.size}</span>
          </p>
        )}
        {item.color && (
          <p className="text-xs sm:text-sm">
            Color: <span className="text-ink/60">{item.color}</span>
          </p>
        )}
        {item.issue && <p className="mt-1 text-xs font-medium text-sale sm:text-sm">{item.issue}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-xl font-bold sm:text-2xl">{money(item.line_total_cents)}</p>
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={maxQuantity}
            disabled={update.isPending || item.product.stock === 0}
            onChange={(quantity) => update.mutate({ id: item.id, quantity })}
            className="w-[105px] sm:w-[126px]"
          />
        </div>
      </div>
    </div>
  );
}
