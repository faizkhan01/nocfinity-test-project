"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { loginSchema, safeNext } from "@/lib/validation";

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { form, formError, submitWith } = useApiForm(loginSchema, { defaultValues: { email: "", password: "" } });

  const onSubmit = submitWith(async (values) => {
    await api("admin/auth/login", { method: "POST", body: values });
    const next = safeNext(params.get("next"), "/admin");
    router.replace(next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <Input label="Email" type="email" autoComplete="username" {...form.register("email")} error={form.formState.errors.email?.message} />
      <Input label="Password" type="password" autoComplete="current-password" {...form.register("password")} error={form.formState.errors.password?.message} />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
