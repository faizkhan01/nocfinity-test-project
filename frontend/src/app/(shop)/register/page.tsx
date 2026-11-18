import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { RegisterForm } from "@/components/shop/auth/register-form";
import { hasSession } from "@/lib/api/server";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await hasSession("customer")) redirect("/account");

  return (
    <AuthCard title="Create account" subtitle="Use code WELCOME20 for 20% off your first order.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
