import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { SectionHeading } from "@/components/shop/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import { cn, formatDate, money } from "@/lib/format";
import type { Order, OrderStatus, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "My orders" };

const FILTERS: (OrderStatus | "all")[] = ["all", "pending", "paid", "processing", "shipped", "delivered", "cancelled"];

type Props = { searchParams: Promise<{ page?: string; status?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const { page = "1", status } = await searchParams;
  const active = FILTERS.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const query = new URLSearchParams({ page: String(Math.max(1, Number(page) || 1)), ...(active ? { status: active } : {}) });

  const orders = await apiGet<Paginated<Order>>(`orders?${query}`, { auth: "customer" }).catch((error) => {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/orders");
    throw error;
  });

  const href = (p: number, s = active) => `/orders?${new URLSearchParams({ page: String(p), ...(s ? { status: s } : {}) })}`;

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My orders" }]} className="mt-5 sm:mt-6" />
      <SectionHeading as="h1" className="mt-2 sm:mt-6 sm:text-[40px] sm:leading-[48px]">
        My orders
      </SectionHeading>

      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/orders" : href(1, f)}
            className={cn(
              "shrink-0 rounded-pill px-4 py-2 text-sm capitalize",
              (f === "all" ? !active : active === f) ? "bg-ink text-white" : "bg-surface text-ink/60 hover:text-ink",
            )}
          >
            {f === "pending" ? "Awaiting payment" : f}
          </Link>
        ))}
      </nav>

      {orders.data.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[20px] bg-surface px-6 py-16 text-center">
          <p className="text-xl font-bold">No orders {active ? "with this status" : "yet"}</p>
          <ButtonLink href="/shop">Start shopping</ButtonLink>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {orders.data.map((order) => (
            <li key={order.order_number}>
              <Link
                href={`/orders/${order.order_number}`}
                className="flex flex-col gap-3 rounded-[20px] border border-line p-5 transition-colors hover:border-ink/30 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div>
                  <p className="font-bold">{order.order_number}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    Placed {formatDate(order.placed_at)} · {order.items?.reduce((n, i) => n + i.quantity, 0) ?? 0} item(s)
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-ink/60">{order.items?.map((i) => i.name).join(", ")}</p>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <StatusBadge status={order.status} />
                  <p className="text-lg font-bold">{money(order.total_cents, order.currency)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination current={orders.meta.current_page} last={orders.meta.last_page} href={(p) => href(p)} className="mt-8" />
    </div>
  );
}
