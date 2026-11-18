import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/admin/orders";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return <OrderDetail id={id} />;
}
