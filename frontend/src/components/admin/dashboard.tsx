"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, DollarSign, ShoppingBag, Truck, Users } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api/client";
import { formatDate, money } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Forbidden } from "./forbidden";
import { useCan } from "./staff-context";
import { Card, PageHeader, Table } from "./ui";

type Dashboard = {
  stats: { today_orders: number; today_revenue_cents: number | null; total_customers: number; low_stock_count: number; pending_fulfilment: number };
  sales_chart?: { date: string; orders: number; revenue_cents: number }[];
  recent_orders?: Order[];
  low_stock_products?: { id: number; name: string; sku: string; stock: number; low_stock_threshold: number }[];
};

export function DashboardView() {
  const can = useCan();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => (await api<{ data: Dashboard }>("admin/dashboard")).data,
    enabled: can("dashboard.view"),
  });

  if (!can("dashboard.view")) return <Forbidden />;

  const stats = data?.stats;
  const cards = [
    { label: "Today's orders", value: stats?.today_orders ?? "—", icon: ShoppingBag },
    { label: "Today's revenue", value: stats?.today_revenue_cents != null ? money(stats.today_revenue_cents) : "Restricted", icon: DollarSign },
    { label: "Total customers", value: stats?.total_customers ?? "—", icon: Users },
    { label: "Low-stock products", value: stats?.low_stock_count ?? "—", icon: AlertTriangle, alert: (stats?.low_stock_count ?? 0) > 0 },
    { label: "Awaiting fulfilment", value: stats?.pending_fulfilment ?? "—", icon: Truck },
  ];

  const chart = data?.sales_chart?.map((d) => ({ ...d, revenue: d.revenue_cents / 100, label: d.date.slice(5) }));
  const monthRevenue = data?.sales_chart?.reduce((sum, d) => sum + d.revenue_cents, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Store performance at a glance." />

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, alert }) => (
          <li key={label}>
            <Card className="p-5">
              <div className="flex items-center justify-between text-ink/50">
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                <Icon className={alert ? "size-5 text-amber-500" : "size-5"} />
              </div>
              <p className="mt-3 text-2xl font-bold">{isLoading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-surface" /> : value}</p>
            </Card>
          </li>
        ))}
      </ul>

      {chart && (
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-bold">Sales, last 30 days</h2>
              <p className="text-sm text-ink/60">Revenue from paid orders by day</p>
            </div>
            <p className="text-xl font-bold">{money(monthRevenue)}</p>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-ink)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-ink)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval={4} tick={{ fill: "var(--color-ink)", opacity: 0.6 }} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tick={{ fill: "var(--color-ink)", opacity: 0.6 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-white)", border: "1px solid var(--color-line)", borderRadius: 12, color: "var(--color-ink)" }}
                  formatter={(value: number, name) => (name === "revenue" ? [money(value * 100), "Revenue"] : [value, "Orders"])}
                  labelFormatter={(_, payload) => (payload?.[0] ? formatDate(payload[0].payload.date) : "")}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-ink)" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
        {data?.recent_orders && (
          <Card>
            <div className="flex items-center justify-between p-5">
              <h2 className="font-bold">Recent orders</h2>
              <Link href="/admin/orders" className="text-sm underline">
                View all
              </Link>
            </div>
            <Table head={["Order", "Customer", "Status", "Total", "Placed"]}>
              {data.recent_orders.map((order) => (
                <tr key={order.order_number} className="hover:bg-surface/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer?.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 font-medium">{money(order.total_cents)}</td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(order.placed_at)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
        {data?.low_stock_products && (
          <Card className="p-5">
            <h2 className="font-bold">Low stock</h2>
            {data.low_stock_products.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">Everything is well stocked.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {data.low_stock_products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate hover:underline">
                      {p.name}
                      <span className="ml-2 text-xs text-ink/40">{p.sku}</span>
                    </Link>
                    <span className={p.stock === 0 ? "font-bold text-sale" : "font-bold text-amber-600"}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
