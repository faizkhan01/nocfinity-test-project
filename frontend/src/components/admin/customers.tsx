"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api/client";
import { formatDate, money } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";
import { Forbidden } from "./forbidden";
import { useCan } from "./staff-context";
import { Badge, Card, EmptyRow, LoadingRows, PageHeader, SimplePager, Table } from "./ui";

type AdminCustomer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  email_verified: boolean;
  orders_count: number;
  paid_orders_count: number;
  total_spent_cents: number;
  last_login_at: string | null;
  created_at: string;
};

export function CustomersList() {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customers", search, page],
    queryFn: () => api<Paginated<AdminCustomer>>(`admin/customers?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
    placeholderData: keepPreviousData,
    enabled: can("customers.view"),
  });

  if (!can("customers.view")) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Customers" description={data ? `${data.meta.total} customers` : undefined} />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(term.trim());
            setPage(1);
          }}
          className="m-4 flex h-10 max-w-md items-center gap-2 rounded-xl border border-line px-3"
        >
          <Search className="size-4 text-ink/40" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or email…" aria-label="Search customers" className="w-full bg-transparent text-sm outline-none" />
        </form>
        <Table head={["Customer", "Orders", "Total spent", "Joined", "Last sign in"]}>
          {isLoading ? (
            <LoadingRows colSpan={5} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={5}>No customers found.</EmptyRow>
          ) : (
            data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-surface/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <span className="block text-xs text-ink/50">{c.email}</span>
                </td>
                <td className="px-4 py-3">
                  {c.paid_orders_count}
                  {c.orders_count > c.paid_orders_count && <span className="text-xs text-ink/50"> (+{c.orders_count - c.paid_orders_count} unpaid/cancelled)</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{money(c.total_spent_cents)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(c.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{c.last_login_at ? formatDate(c.last_login_at) : "Never"}</td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={setPage} />}
      </Card>
    </div>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const can = useCan();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customer", id],
    queryFn: async () => (await api<{ data: AdminCustomer & { orders: Order[] } }>(`admin/customers/${id}`)).data,
    enabled: can("customers.view"),
  });

  if (!can("customers.view")) return <Forbidden />;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/customers" className="flex items-center gap-1 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft className="size-4" /> Customers
      </Link>
      <PageHeader title={data.name} description={data.email} actions={data.email_verified ? <Badge tone="green">Email verified</Badge> : <Badge tone="amber">Unverified</Badge>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink/50">Paid orders</p>
          <p className="mt-2 text-2xl font-bold">{data.paid_orders_count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink/50">Total spent</p>
          <p className="mt-2 text-2xl font-bold">{money(data.total_spent_cents)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink/50">Customer since</p>
          <p className="mt-2 text-2xl font-bold">{formatDate(data.created_at)}</p>
        </Card>
      </div>
      <Card>
        <h2 className="p-5 font-bold">Order history</h2>
        <Table head={["Order", "Items", "Total", "Status", "Placed"]}>
          {data.orders.length === 0 ? (
            <EmptyRow colSpan={5}>No orders yet.</EmptyRow>
          ) : (
            data.orders.map((o) => (
              <tr key={o.id} className="hover:bg-surface/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  {can("orders.view") ? (
                    <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                      {o.order_number}
                    </Link>
                  ) : (
                    o.order_number
                  )}
                </td>
                <td className="px-4 py-3">{o.item_count}</td>
                <td className="px-4 py-3 font-medium">{money(o.total_cents)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{formatDate(o.placed_at)}</td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </div>
  );
}
