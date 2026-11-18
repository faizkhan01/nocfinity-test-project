import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Price } from "@/components/shop/price";
import { ProductCard } from "@/components/shop/product-card";
import { Gallery } from "@/components/shop/product/gallery";
import { ProductTabs } from "@/components/shop/product/product-tabs";
import { PurchasePanel } from "@/components/shop/product/purchase-panel";
import { SectionHeading } from "@/components/shop/section-heading";
import { Stars } from "@/components/shop/stars";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import type { Paginated, Product, ProductSummary, Review } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string): Promise<Product> {
  try {
    return (await apiGet<{ data: Product }>(`products/${encodeURIComponent(slug)}`)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  return { title: product.name, description: product.short_description ?? undefined };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const [related, reviews] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>(`products/${encodeURIComponent(slug)}/related`).then((r) => r.data).catch(() => []),
    apiGet<Paginated<Review>>(`products/${encodeURIComponent(slug)}/reviews?sort=latest`),
  ]);

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    ...(product.category?.parent ? [{ label: product.category.parent.name, href: `/shop?category=${product.category.parent.slug}` }] : []),
    ...(product.category ? [{ label: product.category.name, href: `/shop?category=${product.category.slug}` }] : []),
  ];

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: c.label } : c))} className="mt-5 sm:mt-6" />

      <div className="mt-5 grid items-start gap-5 sm:mt-9 lg:grid-cols-[610px_1fr] lg:gap-10">
        <Gallery product={product} />

        <div>
          {/* Non-breaking hyphens keep names like "T-shirt" from splitting across lines. */}
          <h1 className="font-heading text-2xl leading-7 sm:text-[40px] sm:leading-[48px] lg:tracking-[-0.015em]">{product.name.replaceAll("-", "\u2011")}</h1>
          <div className="mt-3 flex items-center gap-4 sm:mt-[14px]">
            <Stars rating={product.rating_avg} className="h-[17px] sm:h-[24.7px]" />
            <span className="text-sm sm:text-base">
              {product.rating_avg.toFixed(1)}/<span className="text-ink/60">5</span>
            </span>
          </div>
          <Price
            final={product.final_price_cents}
            original={product.discount_price_cents ? product.price_cents : null}
            percent={product.discount_percent}
            size="detail"
            className="mt-3 sm:mt-[14px]"
          />
          {product.short_description && (
            <p className="border-b border-line pb-6 pt-5 text-sm leading-5 text-ink/60 sm:text-base sm:leading-[22px]">{product.short_description}</p>
          )}
          <PurchasePanel product={product} />
        </div>
      </div>

      <ProductTabs product={product} initialReviews={reviews} />

      {related.length > 0 && (
        <section className="pt-[50px] sm:pt-16">
          <SectionHeading className="text-center">You might also like</SectionHeading>
          <ul className="no-scrollbar -mx-4 mt-8 flex gap-4 overflow-x-auto px-4 sm:mt-[55px] lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:px-0">
            {related.map((item) => (
              <li key={item.id} className="w-[198px] shrink-0 lg:w-auto">
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
