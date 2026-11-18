import { ProductCard } from "@/components/shop/product-card";
import { SectionHeading } from "@/components/shop/section-heading";
import { ButtonLink } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/types";

export function ProductRow({ title, products, href }: { title: string; products: ProductSummary[]; href: string }) {
  return (
    <section className="pt-[50px] lg:pt-[72px]">
      <SectionHeading className="container-shop text-center">{title}</SectionHeading>
      {products.length === 0 ? (
        <p className="container-shop mt-8 text-center text-ink/60">Products are on their way.</p>
      ) : (
        <div className="no-scrollbar mt-8 overflow-x-auto lg:mt-[55px]">
          <ul className="container-shop flex gap-4 lg:grid lg:grid-cols-4 lg:gap-5">
            {products.map((product) => (
              <li key={product.id} className="w-[198px] shrink-0 lg:w-auto">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="container-shop mt-6 flex justify-center lg:mt-9">
        <ButtonLink href={href} variant="outline" size="lg" className="w-full sm:w-[218px]">
          View All
        </ButtonLink>
      </div>
    </section>
  );
}
