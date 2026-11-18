import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForms } from "@/components/shop/auth/account-forms";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import type { Customer } from "@/lib/types";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const customer = await apiGet<{ data: Customer }>("auth/me", { auth: "customer" })
    .then((r) => r.data)
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) redirect("/login?next=/account");
      throw error;
    });

  return (
    <div className="container-shop">
      <hr className="border-line" />
      <h1 className="mt-8 font-heading text-[32px] leading-9 sm:text-[40px] sm:leading-[48px]">My account</h1>
      {(await searchParams).verified && (
        <p role="status" className="mt-4 rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          Your email address has been verified.
        </p>
      )}
      <AccountForms customer={customer} />
    </div>
  );
}
