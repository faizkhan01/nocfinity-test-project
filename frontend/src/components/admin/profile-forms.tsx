"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { changePasswordSchema } from "@/lib/validation";
import { useStaff } from "./staff-context";
import { TwoFactorCard } from "./two-factor-card";
import { Badge, Card, PageHeader, TextInput } from "./ui";

export function ProfileForms() {
  const staff = useStaff();
  const router = useRouter();
  const profile = useApiForm(z.object({ name: z.string().trim().min(2, "Enter your name.").max(100) }), { defaultValues: { name: staff.name } });
  const password = useApiForm(changePasswordSchema, { defaultValues: { current_password: "", password: "", password_confirmation: "" } });

  const saveProfile = profile.submitWith(async (values) => {
    await api("admin/profile", { method: "PUT", body: values });
    toast.success("Profile updated");
    router.refresh();
  });

  const savePassword = password.submitWith(async (values) => {
    await api("admin/profile/password", { method: "PUT", body: values });
    password.form.reset();
    toast.success("Password changed. Your other sessions were signed out.");
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My profile" description="Update your name, password and sign-in security." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
            <h2 className="font-bold">Account</h2>
            <TextInput label="Email" value={staff.email} disabled readOnly />
            <TextInput label="Name" {...profile.form.register("name")} error={profile.form.formState.errors.name?.message} />
            <div className="flex flex-wrap gap-2">
              {staff.roles.map((r) => (
                <Badge key={r.id} tone="blue">
                  {r.name}
                </Badge>
              ))}
            </div>
            <FormError message={profile.formError} />
            <Button type="submit" size="sm" className="self-start" loading={profile.form.formState.isSubmitting}>
              Save
            </Button>
          </form>
        </Card>
        <Card className="p-6">
          <form onSubmit={savePassword} noValidate className="flex flex-col gap-4">
            <h2 className="font-bold">Change password</h2>
            <TextInput label="Current password" type="password" autoComplete="current-password" {...password.form.register("current_password")} error={password.form.formState.errors.current_password?.message} />
            <TextInput label="New password" type="password" autoComplete="new-password" {...password.form.register("password")} error={password.form.formState.errors.password?.message} />
            <TextInput label="Confirm new password" type="password" autoComplete="new-password" {...password.form.register("password_confirmation")} error={password.form.formState.errors.password_confirmation?.message} />
            <FormError message={password.formError} />
            <Button type="submit" size="sm" className="self-start" loading={password.form.formState.isSubmitting}>
              Update password
            </Button>
          </form>
        </Card>
        <TwoFactorCard />
      </div>
    </div>
  );
}
