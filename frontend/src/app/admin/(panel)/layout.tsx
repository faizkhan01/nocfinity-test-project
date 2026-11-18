import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/sidebar";
import { StaffProvider } from "@/components/admin/staff-context";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/errors";
import type { Staff } from "@/lib/types";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | SHOP.CO Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Validates the token and loads effective permissions; an expired or revoked token goes back to login.
  const staff = await apiGet<{ data: Staff }>("admin/auth/me", { auth: "admin" })
    .then((r) => r.data)
    .catch((error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) redirect("/admin/login");
      throw error;
    });

  return (
    <StaffProvider staff={staff}>
      <AdminShell>{children}</AdminShell>
    </StaffProvider>
  );
}
