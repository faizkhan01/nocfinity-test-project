"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { assetUrl, formatDate, money } from "@/lib/format";
import type { Order, OrderStatus, Paginated } from "@/lib/types";
import { Forbidden } from "./forbidden";
import { Can, useCan } from "./staff-context";
import { Card, EmptyRow, LoadingRows, PageHeader, Select, SimplePager, Table, TextInput } from "./ui";

const STATUSES: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];

export function OrdersList() {
  const can = useCan();
  const [filters, setFilters] = useState({ status: "", search: "", date_from: "", date_to: "", page: 1 });
  const [term, setTerm] = useState("");
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "orders", filters],
    queryFn: () => api<Paginated<Order>>(`admin/orders?${query}`),
    placeholderData: keepPreviousData,
    enabled: can("orders.view"),
  });

  if (!can("orders.view")) return <Forbidden />;
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" description={data ? `${data.meta.total} orders` : undefined} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_160px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set({ search: term.trim() });
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-line px-3"
          >
            <Search className="size-4 text-ink/40" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Order number, customer name or email…" aria-label="Search orders" className="w-full bg-transparent text-sm outline-none" />
          </form>
          <Select aria-label="Status" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
          <TextInput type="date" aria-label="From date" value={filters.date_from} onChange={(e) => set({ date_from: e.target.value })} />
          <TextInput type="date" aria-label="To date" value={filters.date_to} onChange={(e) => set({ date_to: e.target.value })} />
        </div>
        {isError && <p className="p-4 text-sm text-sale">{errorMessage(error)}</p>}
        <Table head={["Order", "Customer", "Items", "Total", "Status", "Placed"]}>
          {isLoading ? (
            <LoadingRows colSpan={6} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={6}>No orders found.</EmptyRow>
          ) : (
            data?.data.map((o) => (
              <tr key={o.id} className="hover:bg-surface/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{o.customer?.name}</span>
                  <span className="text-xs text-ink/50">{o.customer?.email}</span>
                </td>
                <td className="px-4 py-3">{o.item_count}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{money(o.total_cents)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(o.placed_at)}</td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={(page) => set({ page })} />}
      </Card>
    </div>
  );
}

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  processing: "Mark as processing",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

export function OrderDetail({ id }: { id: string }) {
  const can = useCan();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: async () => (await api<{ data: Order }>(`admin/orders/${id}`)).data,
    enabled: can("orders.view"),
  });

  const update = useMutation({
    mutationFn: (status: OrderStatus) => api<{ data: Order }>(`admin/orders/${id}/status`, { method: "PATCH", body: { status, note: note || null } }),
    onSuccess: ({ data }) => {
      client.setQueryData(["admin", "order", id], data);
      client.invalidateQueries({ queryKey: ["admin", "orders"] });
      setNote("");
      toast.success(`Order is now ${data.status}. The customer has been emailed.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!can("orders.view")) return <Forbidden />;
  if (isLoading || !order) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;

  const transitions = order.allowed_transitions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/orders" className="flex items-center gap-1 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <PageHeader title={order.order_number} description={`Placed ${formatDate(order.placed_at, true)}`} actions={<StatusBadge status={order.status} className="text-sm" />} />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Card>
            <Table head={["Item", "Options", "Unit", "Qty", "Total"]}>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-product">
                        {item.image && <Image src={assetUrl(item.image)!} alt="" fill sizes="44px" className="object-cover" />}
                      </span>
                      <span>
                        <span className="block font-medium">{item.name}</span>
                        <span className="text-xs text-ink/50">{item.sku}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{[item.size, item.color].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3">{money(item.unit_price_cents)}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3 font-medium">{money(item.line_total_cents)}</td>
                </tr>
              ))}
            </Table>
            <dl className="ml-auto flex max-w-xs flex-col gap-2 p-5 text-sm">
              <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{money(order.subtotal_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt><dd className="text-sale">{order.discount_cents ? `-${money(order.discount_cents)}` : money(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Shipping</dt><dd>{money(order.shipping_cents)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{money(order.total_cents, order.currency)}</dd></div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold">History</h2>
            <ol className="mt-4 flex flex-col gap-4 border-l border-line pl-5">
              {order.history?.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-ink" />
                  <p className="text-sm font-medium capitalize">
                    {h.from ? `${h.from} → ` : ""}
                    {h.to}
                  </p>
                  <p className="text-xs text-ink/50">
                    {formatDate(h.at, true)}
                    {h.by ? ` · by ${h.by}` : " · system"}
                  </p>
                  {h.note && <p className="mt-1 text-sm text-ink/70">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Can permission="orders.update_status">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-bold">Update status</h2>
              {transitions.length === 0 ? (
                <p className="text-sm text-ink/60">This order is {order.status}; no further changes are possible.</p>
              ) : (
                <>
                  {order.status === "pending" && <p className="text-xs text-ink/60">Orders become paid automatically when the customer&apos;s payment is captured.</p>}
                  <TextInput placeholder="Note for the history (optional)" aria-label="Status note" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} />
                  {transitions.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === "cancelled" ? "outline" : "primary"}
                      className={status === "cancelled" ? "text-sale" : undefined}
                      loading={update.isPending && update.variables === status}
                      disabled={update.isPending}
                      onClick={() =>
                        (status !== "cancelled" || window.confirm("Cancel this order? Paid amounts are refunded and stock is restored.")) && update.mutate(status)
                      }
                    >
                      {ACTION_LABEL[status] ?? status}
                    </Button>
                  ))}
                </>
              )}
            </Card>
          </Can>

          <Card className="p-5 text-sm">
            <h2 className="font-bold">Customer</h2>
            <p className="mt-3 font-medium">{order.customer?.name}</p>
            <p className="text-ink/60">{order.customer?.email}</p>
            {order.customer?.phone && <p className="text-ink/60">{order.customer.phone}</p>}
            <Can permission="customers.view">
              <Link href={`/admin/customers/${order.customer?.id}`} className="mt-2 inline-block underline">
                View customer
              </Link>
            </Can>
            <h2 className="mt-5 font-bold">Shipping address</h2>
            <address className="mt-2 not-italic leading-6 text-ink/70">
              {order.shipping.name}, {order.shipping.phone}
              <br />
              {order.shipping.line1}
              {order.shipping.line2 ? `, ${order.shipping.line2}` : ""}
              <br />
              {order.shipping.city}
              {order.shipping.state ? `, ${order.shipping.state}` : ""} {order.shipping.postal_code}, {order.shipping.country}
            </address>
            {order.notes && <p className="mt-2 rounded-lg bg-surface p-2 text-ink/70">Note: {order.notes}</p>}
            <h2 className="mt-5 font-bold">Payment</h2>
            <p className="mt-2 capitalize text-ink/70">{order.payment?.status ?? "—"}</p>
            {order.payment?.reference && <p className="break-all text-xs text-ink/40">{order.payment.reference}</p>}
            {order.payment?.failure_message && <p className="mt-1 text-sale">{order.payment.failure_message}</p>}
            {order.cancellation_reason && <p className="mt-3 text-sale">Cancelled: {order.cancellation_reason}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
