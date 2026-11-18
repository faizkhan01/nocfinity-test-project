"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { loginSchema, safeNext } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const { form, formError, submitWith } = useApiForm(loginSchema, { defaultValues: { email: "", password: "" } });
  const { register, formState } = form;

  const onSubmit = submitWith(async (values) => {
    await api("auth/login", { method: "POST", body: values });
    await client.invalidateQueries();
    toast.success("Welcome back!");
    router.push(safeNext(params.get("next")));
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input label="Email" type="email" autoComplete="email" {...register("email")} error={formState.errors.email?.message} />
      <Input label="Password" type="password" autoComplete="current-password" {...register("password")} error={formState.errors.password?.message} />
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-ink/60 underline hover:text-ink">
          Forgot password?
        </Link>
      </div>
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={formState.isSubmitting}>
        Sign in
      </Button>
      <p className="text-center text-sm text-ink/60">
        New here?{" "}
        <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-medium text-ink underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
