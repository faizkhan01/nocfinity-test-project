import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/sidebar";
import { StaffProvider } from "@/components/admin/staff-context";
import { AdminThemeRoot } from "@/components/admin/theme-toggle";
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/lib/admin-theme";
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
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);

  return (
    <StaffProvider staff={staff}>
      <AdminThemeRoot initial={theme} className="min-h-dvh">
        <AdminShell>{children}</AdminShell>
      </AdminThemeRoot>
    </StaffProvider>
  );
}
