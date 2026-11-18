"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Color } from "@/lib/types";

export type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  category: { id: number; name: string; parent_id: number | null } | null;
  category_id: number;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  discount_price_cents: number | null;
  stock: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  colors: Color[];
  sizes: string[];
  style: string | null;
  is_active: boolean;
  is_featured: boolean;
  rating_avg: number;
  sold_count: number;
  image?: string | null;
  images?: { id: number; url: string }[];
};

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parent_id: number | null;
  is_active: boolean;
  sort_order: number;
  products_count: number;
  children: AdminCategory[];
};

export function useAdminCategories() {
  const query = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await api<{ data: AdminCategory[] }>("admin/categories")).data,
    staleTime: 60_000,
  });

  const tree = query.data ?? [];
  return { ...query, tree, flat: tree.flatMap((c) => [c, ...c.children]) };
}
