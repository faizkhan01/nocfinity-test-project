import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { ResetPasswordForm } from "@/components/shop/auth/password-reset-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
