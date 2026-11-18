import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderActions } from "@/components/shop/orders/order-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import { assetUrl, cn, formatDate, money } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ placed?: string }> };

const STEPS: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const { placed } = await searchParams;

  // The API scopes this lookup to the signed-in customer, so another customer's order is a 404.
  const order = await apiGet<{ data: Order }>(`orders/${encodeURIComponent(number)}`, { auth: "customer" })
    .then((r) => r.data)
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) redirect(`/login?next=/orders/${encodeURIComponent(number)}`);
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });

  const reached = STEPS.indexOf(order.status);

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My orders", href: "/orders" }, { label: order.order_number }]} className="mt-5 sm:mt-6" />

      {placed && order.status !== "pending" && order.status !== "cancelled" && (
        <div className="mt-6 rounded-[20px] bg-ink p-6 text-white sm:p-8">
          <p className="font-heading text-2xl sm:text-[32px] sm:leading-9">Thank you for your order!</p>
          <p className="mt-2 text-white/70">
            Your payment was successful and order <span className="font-medium text-white">{order.order_number}</span> is confirmed. A confirmation email is on its way.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-[32px]">{order.order_number}</h1>
          <p className="mt-1 text-ink/60">Placed {formatDate(order.placed_at, true)}</p>
        </div>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      {order.status === "cancelled" ? (
        <p className="mt-6 rounded-[20px] bg-sale/10 p-5 text-sale">
          This order was cancelled{order.cancellation_reason ? `: ${order.cancellation_reason}` : "."}
        </p>
      ) : order.status === "pending" ? (
        <p className="mt-6 rounded-[20px] bg-amber-50 p-5 text-amber-900">
          {order.payment?.failure_message ? `Your last payment attempt failed: ${order.payment.failure_message}` : "This order is waiting for payment."}
        </p>
      ) : (
        <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Order progress">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col gap-2">
              <span className={cn("h-1.5 rounded-full", i <= reached ? "bg-ink" : "bg-surface")} />
              <span className={cn("text-xs capitalize sm:text-sm", i <= reached ? "font-medium" : "text-ink/40")}>{step}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1fr_400px]">
        <ul className="rounded-[20px] border border-line p-5 sm:p-6">
          {order.items?.map((item, i) => (
            <li key={item.id}>
              {i > 0 && <hr className="my-4 border-line" />}
              <div className="flex gap-4">
                <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-product sm:size-24">
                  {item.image && <Image src={assetUrl(item.image)!} alt={item.name} fill sizes="96px" className="object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  {item.product_slug ? (
                    <Link href={`/product/${item.product_slug}`} className="font-bold hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    <p className="font-bold">{item.name}</p>
                  )}
                  <p className="mt-1 text-sm text-ink/60">
                    {[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">
                    {money(item.unit_price_cents)} × {item.quantity}
                  </p>
                </div>
                <p className="font-bold">{money(item.line_total_cents)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-5">
          <section className="rounded-[20px] border border-line p-5 sm:p-6">
            <h2 className="text-xl font-bold">Summary</h2>
            <dl className="mt-4 flex flex-col gap-3">
              <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd className="font-bold">{money(order.subtotal_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt><dd className="font-bold text-sale">{order.discount_cents ? `-${money(order.discount_cents)}` : money(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Delivery</dt><dd className="font-bold">{money(order.shipping_cents)}</dd></div>
              <hr className="border-line" />
              <div className="flex justify-between text-lg"><dt>Total</dt><dd className="font-bold">{money(order.total_cents, order.currency)}</dd></div>
            </dl>
          </section>
          <section className="rounded-[20px] border border-line p-5 sm:p-6">
            <h2 className="text-xl font-bold">Shipping to</h2>
            <address className="mt-3 not-italic leading-6 text-ink/70">
              {order.shipping.name}
              <br />
              {order.shipping.line1}
              {order.shipping.line2 && (
                <>
                  <br />
                  {order.shipping.line2}
                </>
              )}
              <br />
              {order.shipping.city}
              {order.shipping.state ? `, ${order.shipping.state}` : ""} {order.shipping.postal_code}
              <br />
              {order.shipping.country} · {order.shipping.phone}
            </address>
            {order.notes && <p className="mt-3 text-sm text-ink/60">Note: {order.notes}</p>}
          </section>
          <OrderActions order={order} />
        </div>
      </div>
    </div>
  );
}
