"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { emailRule, resetSchema } from "@/lib/validation";

/** Shared by the storefront and the admin panel; `scope` selects the API broker. */
export function ForgotPasswordForm({ scope = "customer" }: { scope?: "customer" | "admin" }) {
  const [sent, setSent] = useState(false);
  const { form, formError, submitWith } = useApiForm(z.object({ email: emailRule }), { defaultValues: { email: "" } });
  const base = scope === "admin" ? "admin/auth" : "auth";

  const onSubmit = submitWith(async (values) => {
    await api(`${base}/forgot-password`, { method: "POST", body: values });
    setSent(true);
  });

  if (sent) {
    return (
      <p role="status" className="rounded-2xl bg-surface p-4 text-sm">
        If an account exists for that email, a reset link is on its way. It expires in {scope === "admin" ? 30 : 60} minutes.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input label="Email" type="email" autoComplete="email" {...form.register("email")} error={form.formState.errors.email?.message} />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Send reset link
      </Button>
      <Link href={scope === "admin" ? "/admin/login" : "/login"} className="text-center text-sm text-ink/60 underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ scope = "customer" }: { scope?: "customer" | "admin" }) {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const { form, formError, submitWith } = useApiForm(resetSchema, { defaultValues: { password: "", password_confirmation: "" } });
  const base = scope === "admin" ? "admin/auth" : "auth";

  if (!token || !email) {
    return <FormError message="This reset link is incomplete. Please request a new one." />;
  }

  const onSubmit = submitWith(async (values) => {
    await api(`${base}/reset-password`, { method: "POST", body: { ...values, token, email } });
    toast.success("Password updated. Please sign in.");
    router.push(scope === "admin" ? "/admin/login" : "/login");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input label="Email" value={email} readOnly disabled />
      <Input label="New password" type="password" autoComplete="new-password" {...form.register("password")} error={form.formState.errors.password?.message} />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        {...form.register("password_confirmation")}
        error={form.formState.errors.password_confirmation?.message}
      />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Reset password
      </Button>
    </form>
  );
}
