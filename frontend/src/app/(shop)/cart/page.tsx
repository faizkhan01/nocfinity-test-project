import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartView } from "@/components/shop/cart/cart-view";
import { SectionHeading } from "@/components/shop/section-heading";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} className="mt-5 sm:mt-6" />
      <SectionHeading as="h1" className="mt-2 sm:mt-6 sm:text-[40px] sm:leading-[48px]">
        Your cart
      </SectionHeading>
      <CartView />
    </div>
  );
}
