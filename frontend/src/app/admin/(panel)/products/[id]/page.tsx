import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/products/product-editor";
import type { AdminProduct } from "@/components/admin/products/types";
import { Forbidden } from "@/components/admin/forbidden";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  try {
    const product = (await apiGet<{ data: AdminProduct }>(`admin/products/${id}`, { auth: "admin" })).data;
    return <ProductEditor product={product} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.status === 403) return <Forbidden />;
    throw error;
  }
}
