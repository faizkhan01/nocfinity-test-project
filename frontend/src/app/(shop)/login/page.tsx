import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { LoginForm } from "@/components/shop/auth/login-form";
import { hasSession } from "@/lib/api/server";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  // Signed-in visitors go where the form would send them, so a refresh racing its redirect lands in the same place.
  const { next } = await searchParams;
  if (await hasSession("customer")) redirect(safeNext(typeof next === "string" ? next : null));

  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Sign in to check out and track your orders.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
