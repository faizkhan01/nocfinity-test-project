"use client";

import Link from "next/link";
import { Forbidden } from "../forbidden";
import { useCan } from "../staff-context";
import { PageHeader } from "../ui";
import { ProductForm } from "./product-form";
import type { AdminProduct } from "./types";

export function ProductEditor({ product }: { product?: AdminProduct }) {
  const can = useCan();
  if (!can(product ? "products.edit" : "products.create")) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product ? `Edit ${product.name}` : "New product"}
        description={product ? `SKU ${product.sku} · ${product.sold_count} sold` : "Add a product to the catalog."}
        actions={
          product && (
            <Link href={`/product/${product.slug}`} target="_blank" className="text-sm underline">
              View in shop ↗
            </Link>
          )
        }
      />
      <ProductForm product={product} />
    </div>
  );
}
