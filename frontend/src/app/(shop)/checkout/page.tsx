import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CheckoutView } from "@/components/shop/checkout/checkout-view";
import { SectionHeading } from "@/components/shop/section-heading";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import type { Customer } from "@/lib/types";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const customer = await apiGet<{ data: Customer }>("auth/me", { auth: "customer" })
    .then((r) => r.data)
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) redirect("/login?next=/checkout");
      throw error;
    });

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} className="mt-5 sm:mt-6" />
      <SectionHeading as="h1" className="mt-2 sm:mt-6 sm:text-[40px] sm:leading-[48px]">
        Checkout
      </SectionHeading>
      <CheckoutView customer={customer} />
    </div>
  );
}
