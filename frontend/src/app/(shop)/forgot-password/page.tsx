import type { Metadata } from "next";
import { AuthCard } from "@/components/shop/auth/auth-card";
import { ForgotPasswordForm } from "@/components/shop/auth/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password" subtitle="Enter your email and we'll send you a link to reset your password.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
