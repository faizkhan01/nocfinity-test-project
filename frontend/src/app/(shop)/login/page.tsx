import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { LoginForm } from "@/components/shop/auth/login-form";
import { hasSession } from "@/lib/api/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await hasSession("customer")) redirect("/account");

  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Sign in to check out and track your orders.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
