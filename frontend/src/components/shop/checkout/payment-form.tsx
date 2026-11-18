"use client";

import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { money } from "@/lib/format";

const stripeCache = new Map<string, Promise<Stripe | null>>();

function stripeFor(key: string) {
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key)!;
}

type Props = { orderNumber: string; clientSecret: string; publishableKey: string; totalCents: number; cardholder: string };

/** Card-only Stripe Elements form. Funds are only authorized here; the server captures after securing stock. */
export function PaymentForm(props: Props) {
  const stripe = useMemo(() => stripeFor(props.publishableKey), [props.publishableKey]);

  return (
    <Elements stripe={stripe}>
      <CardForm {...props} />
    </Elements>
  );
}

function CardForm({ orderNumber, clientSecret, totalCents, cardholder }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [busy, setBusy] = useState(false);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;

    setBusy(true);
    setError(null);

    const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card, billing_details: { name: cardholder } } });

    if (result.error && result.error.payment_intent?.status !== "requires_capture") {
      setError(result.error.message ?? "Your card could not be charged.");
      setBusy(false);
      return;
    }

    try {
      await api(`orders/${orderNumber}/confirm-payment`, { method: "POST" });
      await client.invalidateQueries({ queryKey: ["cart"] });
      router.replace(`/orders/${orderNumber}?placed=1`);
    } catch (err) {
      setError(errorMessage(err));
      // Sold out or voided: the authorization was cancelled, so this order cannot be retried.
      setFatal(err instanceof ApiError && ["insufficient_stock", "payment_mismatch", "payment_cancelled", "coupon_invalid"].includes(err.code ?? ""));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={pay} className="flex flex-col gap-5">
      <div className="rounded-[20px] border border-line px-5 py-4 focus-within:ring-2 focus-within:ring-ink">
        <CardElement
          options={{
            hidePostalCode: true,
            disableLink: true,
            style: {
              base: { fontSize: "16px", color: "#000", fontFamily: "system-ui, sans-serif", "::placeholder": { color: "rgba(0,0,0,0.4)" } },
              invalid: { color: "#ff3333" },
            },
          }}
        />
      </div>
      <FormError message={error} />
      {fatal ? (
        <Link href="/cart" className="text-center font-medium underline">
          Return to your cart
        </Link>
      ) : (
        <Button type="submit" size="lg" className="h-[60px] w-full" loading={busy} disabled={!stripe}>
          Pay {money(totalCents)}
        </Button>
      )}
      <p className="text-center text-xs text-ink/50">
        Payments are processed securely by Stripe. Test card: 4242 4242 4242 4242, any future date and CVC.
      </p>
    </form>
  );
}
