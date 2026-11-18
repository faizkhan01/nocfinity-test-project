"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { customerKey } from "@/hooks/use-customer";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { Customer } from "@/lib/types";
import { changePasswordSchema } from "@/lib/validation";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]*$/, "Enter a valid phone number.").max(30),
});

export function AccountForms({ customer }: { customer: Customer }) {
  const router = useRouter();
  const client = useQueryClient();
  const [resending, setResending] = useState(false);

  const profile = useApiForm(profileSchema, { defaultValues: { name: customer.name, phone: customer.phone ?? "" } });
  const password = useApiForm(changePasswordSchema, { defaultValues: { current_password: "", password: "", password_confirmation: "" } });

  const saveProfile = profile.submitWith(async (values) => {
    await api("auth/profile", { method: "PUT", body: { ...values, phone: values.phone || null } });
    await client.invalidateQueries({ queryKey: customerKey });
    toast.success("Profile updated");
    router.refresh();
  });

  const savePassword = password.submitWith(async (values) => {
    await api("auth/password", { method: "PUT", body: values });
    password.form.reset();
    toast.success("Password changed. Other devices have been signed out.");
  });

  const resend = async () => {
    setResending(true);
    try {
      await api("auth/email/resend", { method: "POST" });
      toast.success("Verification email sent");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1fr_320px]">
      <form onSubmit={saveProfile} noValidate className="flex flex-col gap-5 rounded-[20px] border border-line p-6">
        <h2 className="text-xl font-bold">Profile</h2>
        <Input label="Email" value={customer.email} disabled readOnly hint={customer.email_verified ? "Verified" : "Not verified yet"} />
        <Input label="Full name" {...profile.form.register("name")} error={profile.form.formState.errors.name?.message} />
        <Input label="Phone" type="tel" {...profile.form.register("phone")} error={profile.form.formState.errors.phone?.message} />
        <FormError message={profile.formError} />
        <Button type="submit" loading={profile.form.formState.isSubmitting}>
          Save profile
        </Button>
      </form>

      <form onSubmit={savePassword} noValidate className="flex flex-col gap-5 rounded-[20px] border border-line p-6">
        <h2 className="text-xl font-bold">Change password</h2>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...password.form.register("current_password")}
          error={password.form.formState.errors.current_password?.message}
        />
        <Input label="New password" type="password" autoComplete="new-password" {...password.form.register("password")} error={password.form.formState.errors.password?.message} />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          {...password.form.register("password_confirmation")}
          error={password.form.formState.errors.password_confirmation?.message}
        />
        <FormError message={password.formError} />
        <Button type="submit" loading={password.form.formState.isSubmitting}>
          Update password
        </Button>
      </form>

      <aside className="flex flex-col gap-4 rounded-[20px] bg-surface p-6">
        <h2 className="text-xl font-bold">Quick links</h2>
        <ButtonLink href="/orders" variant="outline">
          My orders
        </ButtonLink>
        <Link href="/shop" className="text-center text-sm underline">
          Continue shopping
        </Link>
        {!customer.email_verified && (
          <div className="mt-2 border-t border-line pt-4 text-sm">
            <p className="text-ink/70">Please verify your email address to secure your account.</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" loading={resending} onClick={resend}>
              Resend verification email
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
