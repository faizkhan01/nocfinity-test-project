"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentForm } from "@/components/shop/checkout/payment-form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Order } from "@/lib/types";

/** Resume payment for a pending order, or cancel while it has not started processing. */
export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<{ client_secret: string; publishable_key: string } | null>(null);

  const cancel = async () => {
    if (!window.confirm("Cancel this order? Any payment will be refunded to your card.")) return;
    setBusy(true);
    try {
      await api(`orders/${order.order_number}/cancel`, { method: "POST" });
      toast.success("Order cancelled");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    try {
      setIntent((await api<{ data: { client_secret: string; publishable_key: string } }>(`orders/${order.order_number}/payment-intent`)).data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (intent) {
    return (
      <div className="rounded-[20px] border border-line p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Complete payment</h2>
        <PaymentForm
          orderNumber={order.order_number}
          clientSecret={intent.client_secret}
          publishableKey={intent.publishable_key}
          totalCents={order.total_cents}
          cardholder={order.shipping.name}
        />
      </div>
    );
  }

  if (order.status !== "pending" && !order.can_cancel) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {order.status === "pending" && (
        <Button onClick={resume} loading={busy} className="sm:flex-1">
          Complete payment
        </Button>
      )}
      {order.can_cancel && (
        <Button variant="outline" onClick={cancel} disabled={busy} className="sm:flex-1">
          Cancel order
        </Button>
      )}
    </div>
  );
}
