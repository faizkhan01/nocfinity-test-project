"use client";

import Image from "next/image";
import { useState } from "react";
import type { z } from "zod";
import { OrderSummary } from "@/components/shop/cart/order-summary";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { useCart } from "@/hooks/use-cart";
import { api } from "@/lib/api/client";
import { COUNTRIES } from "@/lib/countries";
import { assetUrl, money } from "@/lib/format";
import type { Customer, Order } from "@/lib/types";
import { addressSchema } from "@/lib/validation";
import { PaymentForm } from "./payment-form";

type Started = { order: Order; payment: { client_secret: string; publishable_key: string } };
type Address = z.infer<typeof addressSchema>;

export function CheckoutView({ customer }: { customer: Customer }) {
  const { data: cart, isLoading } = useCart();
  const [started, setStarted] = useState<Started | null>(null);
  const [notes, setNotes] = useState("");
  const { form, formError, submitWith } = useApiForm(addressSchema, {
    defaultValues: { name: customer.name, phone: customer.phone ?? "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "US" },
  });
  const { register, formState } = form;

  // Only the address goes to the API; it prices the order itself from the cart.
  const placeOrder = submitWith(async (shipping: Address) => {
    const result = await api<{ data: Started }>("checkout", { method: "POST", body: { shipping, notes: notes || null } });
    setStarted(result.data);
  });

  if (isLoading) return <div className="mt-6 h-96 animate-pulse rounded-[20px] bg-surface" />;

  if (!started && (!cart || cart.items.length === 0)) {
    return (
      <div className="mt-6 flex flex-col items-center gap-4 rounded-[20px] bg-surface px-6 py-16 text-center">
        <p className="text-xl font-bold">Your cart is empty</p>
        <ButtonLink href="/shop">Continue shopping</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[715px_1fr]">
      <div className="flex flex-col gap-5">
        <section className="rounded-[20px] border border-line p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold sm:text-2xl">1. Shipping address</h2>
            {started && (
              <span className="text-sm text-ink/60">
                {started.order.shipping.city}, {started.order.shipping.country}
              </span>
            )}
          </div>
          {!started && (
            <form onSubmit={placeOrder} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input label="Full name" autoComplete="name" {...register("name")} error={formState.errors.name?.message} />
              <Input label="Phone" type="tel" autoComplete="tel" {...register("phone")} error={formState.errors.phone?.message} />
              <div className="sm:col-span-2">
                <Input label="Street address" autoComplete="address-line1" {...register("line1")} error={formState.errors.line1?.message} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Apartment, suite (optional)" autoComplete="address-line2" {...register("line2")} error={formState.errors.line2?.message} />
              </div>
              <Input label="City" autoComplete="address-level2" {...register("city")} error={formState.errors.city?.message} />
              <Input label="State / region (optional)" autoComplete="address-level1" {...register("state")} error={formState.errors.state?.message} />
              <Input label="Postal code" autoComplete="postal-code" {...register("postal_code")} error={formState.errors.postal_code?.message} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="country" className="text-sm font-medium">
                  Country
                </label>
                <select id="country" {...register("country")} className="h-12 rounded-pill bg-surface px-5 outline-none focus:ring-2 focus:ring-ink">
                  {COUNTRIES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Delivery notes (optional)
                </label>
                <textarea
                  id="notes"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-20 rounded-[20px] bg-surface px-5 py-3 outline-none focus:ring-2 focus:ring-ink"
                />
              </div>
              <div className="sm:col-span-2">
                <FormError message={formError} />
              </div>
              <Button type="submit" size="lg" className="sm:col-span-2" loading={formState.isSubmitting} disabled={cart?.has_issues}>
                Continue to payment
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-[20px] border border-line p-5 sm:p-6">
          <h2 className={started ? "text-xl font-bold sm:text-2xl" : "text-xl font-bold text-ink/40 sm:text-2xl"}>2. Payment</h2>
          {started && (
            <div className="mt-6">
              <p className="mb-4 text-sm text-ink/60">
                Order <span className="font-medium text-ink">{started.order.order_number}</span> is reserved for you. Enter your card to complete it.
              </p>
              <PaymentForm
                orderNumber={started.order.order_number}
                clientSecret={started.payment.client_secret}
                publishableKey={started.payment.publishable_key}
                totalCents={started.order.total_cents}
                cardholder={started.order.shipping.name}
              />
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-5">
        {started ? <PlacedSummary order={started.order} /> : cart && <OrderSummary cart={cart} editableCoupon={false} />}
        {!started && cart && (
          <ul className="flex flex-col gap-3 rounded-[20px] border border-line p-5">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-product">
                  {item.product.image && <Image src={assetUrl(item.product.image)!} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.product.name}</span>
                  <span className="text-ink/60">
                    {[item.size, item.color].filter(Boolean).join(" · ")} × {item.quantity}
                  </span>
                </span>
                <span className="font-bold">{money(item.line_total_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlacedSummary({ order }: { order: Order }) {
  return (
    <section className="rounded-[20px] border border-line p-5 sm:p-6" aria-label="Order total">
      <h2 className="text-xl font-bold sm:text-2xl">Order Summary</h2>
      <dl className="mt-6 flex flex-col gap-4 text-base sm:text-lg">
        <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd className="font-bold">{money(order.subtotal_cents)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/60">Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt><dd className="font-bold text-sale">{order.discount_cents ? `-${money(order.discount_cents)}` : money(0)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/60">Delivery Fee</dt><dd className="font-bold">{money(order.shipping_cents)}</dd></div>
        <hr className="border-line" />
        <div className="flex justify-between"><dt>Total</dt><dd className="text-xl font-bold sm:text-2xl">{money(order.total_cents)}</dd></div>
      </dl>
    </section>
  );
}
