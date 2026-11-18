"use client";

import { useState } from "react";
import { CloseIcon, TagIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useCartMutation } from "@/hooks/use-cart";
import { api } from "@/lib/api/client";
import { cn, money } from "@/lib/format";
import type { Cart } from "@/lib/types";

type Props = { cart: Cart; children?: React.ReactNode; editableCoupon?: boolean; className?: string };

/** Totals always come from the API; the browser never computes or submits prices. */
export function OrderSummary({ cart, children, editableCoupon = true, className }: Props) {
  const discountLabel = cart.coupon && !cart.coupon.error
    ? cart.coupon.type === "percentage" ? `Discount (-${cart.coupon.value}%)` : `Discount (${cart.coupon.code})`
    : "Discount";

  return (
    <section className={cn("rounded-[20px] border border-line px-5 py-5 sm:px-6", className)} aria-label="Order summary">
      <h2 className="text-xl font-bold sm:text-2xl">Order Summary</h2>
      <dl className="mt-4 flex flex-col gap-5 text-base sm:mt-6 sm:text-xl">
        <Row label="Subtotal" value={money(cart.subtotal_cents)} />
        <Row label={discountLabel} value={cart.discount_cents ? `-${money(cart.discount_cents)}` : money(0)} valueClass={cart.discount_cents ? "text-sale" : undefined} />
        <Row label="Delivery Fee" value={cart.shipping_cents ? money(cart.shipping_cents) : "Free"} />
        <hr className="border-line" />
        <div className="flex items-center justify-between">
          <dt>Total</dt>
          <dd className="text-xl font-bold sm:text-2xl">{money(cart.total_cents)}</dd>
        </div>
      </dl>
      {editableCoupon && <CouponForm cart={cart} />}
      {children}
    </section>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink/60">{label}</dt>
      <dd className={cn("font-bold", valueClass)}>{value}</dd>
    </div>
  );
}

function CouponForm({ cart }: { cart: Cart }) {
  const [code, setCode] = useState("");
  const apply = useCartMutation((value: string) => api<{ data: Cart }>("cart/coupon", { method: "POST", body: { code: value } }), {
    success: "Promo code applied",
  });
  const remove = useCartMutation(() => api<{ data: Cart }>("cart/coupon", { method: "DELETE" }), { success: "Promo code removed" });

  if (cart.coupon) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between rounded-pill bg-surface px-4 py-3">
          <span className="flex items-center gap-3 font-medium">
            <TagIcon className="size-5 text-ink/40" /> {cart.coupon.code}
          </span>
          <button type="button" onClick={() => remove.mutate()} aria-label="Remove promo code" disabled={remove.isPending}>
            <CloseIcon className="size-5 text-ink/50" />
          </button>
        </div>
        {cart.coupon.error && <p className="mt-2 text-sm text-sale">{cart.coupon.error}</p>}
      </div>
    );
  }

  return (
    <form
      className="mt-6 flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode("") });
      }}
    >
      <label className="flex flex-1 items-center gap-3 rounded-pill bg-surface px-4 py-3">
        <TagIcon className="size-5 shrink-0 text-ink/40 sm:size-6" />
        <span className="sr-only">Promo code</span>
        <input
          value={code}
          maxLength={40}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Add promo code"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40 sm:text-base"
        />
      </label>
      <Button type="submit" className="h-12 w-[88px] sm:w-[119px]" loading={apply.isPending}>
        Apply
      </Button>
    </form>
  );
}
