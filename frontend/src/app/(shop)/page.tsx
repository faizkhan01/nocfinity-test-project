import { Brands } from "@/components/shop/home/brands";
import { DressStyles } from "@/components/shop/home/dress-styles";
import { Hero } from "@/components/shop/home/hero";
import { ProductRow } from "@/components/shop/home/product-row";
import { Testimonials } from "@/components/shop/home/testimonials";
import { apiGet } from "@/lib/api/server";
import type { Paginated, ProductSummary, Review } from "@/lib/types";

export default async function HomePage() {
  const [arrivals, topSelling, reviews] = await Promise.all([
    apiGet<Paginated<ProductSummary>>("products?sort=newest&per_page=4", { revalidate: 60 }).then((r) => r.data).catch(() => []),
    apiGet<Paginated<ProductSummary>>("products?sort=popular&per_page=4", { revalidate: 60 }).then((r) => r.data).catch(() => []),
    apiGet<{ data: Review[] }>("reviews/featured", { revalidate: 300 }).then((r) => r.data).catch(() => []),
  ]);

  return (
    <>
      <Hero />
      <Brands />
      <ProductRow title="New arrivals" products={arrivals} href="/shop?sort=newest" />
      <div className="container-shop mt-10 lg:mt-16">
        <hr className="border-line" />
      </div>
      <ProductRow title="Top selling" products={topSelling} href="/shop?sort=popular" />
      <DressStyles />
      <Testimonials reviews={reviews} />
    </>
  );
}
