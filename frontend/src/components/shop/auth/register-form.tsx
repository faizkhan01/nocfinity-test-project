"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { registerSchema, safeNext } from "@/lib/validation";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const { form, formError, submitWith } = useApiForm(registerSchema, {
    defaultValues: { name: "", email: "", password: "", password_confirmation: "" },
  });
  const { register, formState } = form;

  const onSubmit = submitWith(async (values) => {
    await api("auth/register", { method: "POST", body: values });
    await client.invalidateQueries();
    toast.success("Account created. Check your inbox to verify your email.");
    router.push(safeNext(params.get("next")));
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input label="Full name" autoComplete="name" {...register("name")} error={formState.errors.name?.message} />
      <Input label="Email" type="email" autoComplete="email" {...register("email")} error={formState.errors.email?.message} />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="8+ characters with upper and lower case letters, a number and a symbol."
        {...register("password")}
        error={formState.errors.password?.message}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        {...register("password_confirmation")}
        error={formState.errors.password_confirmation?.message}
      />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={formState.isSubmitting}>
        Create account
      </Button>
      <p className="text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
