import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { RegisterForm } from "@/components/shop/auth/register-form";
import { hasSession } from "@/lib/api/server";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  // Signed-in visitors go where the form would send them, so a refresh racing its redirect lands in the same place.
  const { next } = await searchParams;
  if (await hasSession("customer")) redirect(safeNext(typeof next === "string" ? next : null));

  return (
    <AuthCard title="Create account" subtitle="Use code WELCOME20 for 20% off your first order.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
