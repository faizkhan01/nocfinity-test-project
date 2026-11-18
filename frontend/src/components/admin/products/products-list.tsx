"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ButtonLink } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { assetUrl, money } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { Forbidden } from "../forbidden";
import { Can, useCan } from "../staff-context";
import { Badge, Card, EmptyRow, LoadingRows, PageHeader, Select, SimplePager, Table, Toggle } from "../ui";
import { useAdminCategories, type AdminProduct } from "./types";

export function ProductsList() {
  const can = useCan();
  const client = useQueryClient();
  const [filters, setFilters] = useState({ search: "", category_id: "", status: "", stock: "", page: 1 });
  const [term, setTerm] = useState("");
  const categories = useAdminCategories();

  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "" && v !== 0).map(([k, v]) => [k, String(v)]));
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", filters],
    queryFn: () => api<Paginated<AdminProduct>>(`admin/products?${query}`),
    placeholderData: keepPreviousData,
    enabled: can("products.view"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api(`admin/products/${id}/status`, { method: "PATCH", body: { is_active } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "products"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Product deleted");
      client.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!can("products.view")) return <Forbidden />;

  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description={data ? `${data.meta.total} products` : undefined}
        actions={
          <Can permission="products.create">
            <ButtonLink href="/admin/products/new" size="sm">
              <Plus className="size-4" /> New product
            </ButtonLink>
          </Can>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_160px_160px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set({ search: term.trim() });
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-line px-3"
          >
            <Search className="size-4 text-ink/40" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name or SKU…" aria-label="Search products" className="w-full bg-transparent text-sm outline-none" />
          </form>
          <Select aria-label="Category" value={filters.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">All categories</option>
            {categories.flat.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? `— ${c.name}` : c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select aria-label="Stock" value={filters.stock} onChange={(e) => set({ stock: e.target.value })}>
            <option value="">Any stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
        </div>

        <Table head={["Product", "SKU", "Category", "Price", "Stock", "Active", ""]}>
          {isLoading ? (
            <LoadingRows colSpan={7} />
          ) : data?.data.length === 0 ? (
            <EmptyRow colSpan={7}>No products match these filters.</EmptyRow>
          ) : (
            data?.data.map((p) => (
              <tr key={p.id} className="hover:bg-surface/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-product">
                      {p.image && <Image src={assetUrl(p.image)!} alt="" fill sizes="44px" className="object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      {p.is_featured && <Badge tone="blue">Featured</Badge>}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/60">{p.sku}</td>
                <td className="px-4 py-3 text-ink/60">{p.category?.name}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {p.discount_price_cents ? (
                    <>
                      <span className="font-medium">{money(p.discount_price_cents)}</span> <span className="text-xs text-ink/40 line-through">{money(p.price_cents)}</span>
                    </>
                  ) : (
                    <span className="font-medium">{money(p.price_cents)}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.stock === 0 ? <Badge tone="red">Out</Badge> : p.is_low_stock ? <Badge tone="amber">{p.stock} low</Badge> : <span>{p.stock}</span>}
                </td>
                <td className="px-4 py-3">
                  <Toggle label={`Toggle ${p.name}`} checked={p.is_active} disabled={!can("products.edit") || toggle.isPending} onChange={(v) => toggle.mutate({ id: p.id, is_active: v })} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Can permission="products.edit">
                      <Link href={`/admin/products/${p.id}`} className="rounded-lg p-2 hover:bg-surface" aria-label={`Edit ${p.name}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Can>
                    <Can permission="products.delete">
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        className="rounded-lg p-2 text-sale hover:bg-sale/10"
                        onClick={() => window.confirm(`Delete "${p.name}"? Past orders keep their copy of it.`) && remove.mutate(p.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
        {data && <SimplePager page={data.meta.current_page} last={data.meta.last_page} onChange={(page) => set({ page })} />}
      </Card>
    </div>
  );
}
