import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminThemeRoot, ThemeToggle } from "@/components/admin/theme-toggle";
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/lib/admin-theme";

export const metadata: Metadata = { title: { default: "Admin sign in", template: "%s | SHOP.CO Admin" }, robots: { index: false } };

export default async function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);

  return (
    <AdminThemeRoot initial={theme} className="relative grid min-h-dvh place-items-center bg-surface p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="font-heading text-2xl">
          SHOP.CO <span className="ml-1 rounded bg-ink px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-white">Admin</span>
        </p>
        {children}
      </div>
    </AdminThemeRoot>
  );
}
