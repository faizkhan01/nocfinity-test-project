import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Filters } from "@/components/shop/listing/filters";
import { SortSelect } from "@/components/shop/listing/sort-select";
import { ProductCard } from "@/components/shop/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { apiGet } from "@/lib/api/server";
import { PER_PAGE, defaultSort, pickParams, shopHref, type ShopParams } from "@/lib/shop-filters";
import type { Category, Facets, Paginated, ProductSummary } from "@/lib/types";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "Shop" };

function titleFor(params: ShopParams, categories: Category[]): string {
  if (params.search) return `Results for “${params.search}”`;
  const all = categories.flatMap((c) => [c, ...(c.children ?? [])]);
  const category = all.find((c) => c.slug === params.category);
  if (category) return category.name;
  if (params.styles && !params.styles.includes(",")) return params.styles.charAt(0).toUpperCase() + params.styles.slice(1);
  if (params.on_sale) return "On Sale";
  if (params.sort === "newest") return "New Arrivals";
  return "All Products";
}

export default async function ShopPage({ searchParams }: Props) {
  const params = pickParams(await searchParams);
  const query = new URLSearchParams({ ...params, sort: params.sort ?? defaultSort(params), per_page: String(PER_PAGE) });

  const [products, categories, facets] = await Promise.all([
    apiGet<Paginated<ProductSummary>>(`products?${query}`),
    apiGet<{ data: Category[] }>("categories", { revalidate: 300 }).then((r) => r.data),
    apiGet<{ data: Facets }>("products/filters", { revalidate: 300 }).then((r) => r.data),
  ]);

  const title = titleFor(params, categories);
  const { current_page: page, last_page: last, total } = products.meta;
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} className="mt-5 sm:mt-6" />

      <div className="mt-5 flex gap-5 sm:mt-6">
        <div className="hidden lg:block">
          <Filters params={params} categories={categories} facets={facets} />
        </div>

        <section className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h1 className="text-2xl font-bold sm:text-[32px]">{title}</h1>
            <div className="flex items-center gap-3 sm:order-none">
              <p className="text-sm text-ink/60 sm:text-base">
                {total === 0 ? "No products" : `Showing ${from}-${to} of ${total} Products`}
              </p>
              <span className="hidden sm:inline">
                <SortSelect params={params} />
              </span>
              <span className="lg:hidden">
                <Filters params={params} categories={categories} facets={facets} />
              </span>
            </div>
          </div>
          <div className="mt-1 sm:hidden">
            <SortSelect params={params} />
          </div>

          {products.data.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-4 rounded-[20px] bg-surface px-6 py-16 text-center">
              <p className="text-xl font-bold">No products match these filters</p>
              <p className="text-ink/60">Try removing a filter or searching for something else.</p>
              <ButtonLink href="/shop">Clear filters</ButtonLink>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-x-[14px] gap-y-6 sm:mt-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-9">
              {products.data.map((product, i) => (
                <li key={product.id}>
                  <ProductCard product={product} priority={i < 3} />
                </li>
              ))}
            </ul>
          )}

          <hr className="mt-8 border-line sm:mt-[33px]" />
          <Pagination current={page} last={last} href={(p) => shopHref(params, { page: String(p) })} className="mt-5" />
        </section>
      </div>
    </div>
  );
}
