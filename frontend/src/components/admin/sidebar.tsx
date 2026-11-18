"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  Receipt,
  ShieldCheck,
  Tags,
  TicketPercent,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/format";
import { useCan, useStaff } from "./staff-context";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { href: string; label: string; icon: LucideIcon; permission: string[] };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: ["dashboard.view"] },
  { href: "/admin/orders", label: "Orders", icon: Receipt, permission: ["orders.view"] },
  { href: "/admin/products", label: "Products", icon: Package, permission: ["products.view"] },
  { href: "/admin/categories", label: "Categories", icon: Tags, permission: ["categories.view", "categories.manage"] },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, permission: ["coupons.view"] },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: ["customers.view"] },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareText, permission: ["reviews.manage"] },
  { href: "/admin/staff", label: "Staff", icon: UserCog, permission: ["staff.view"] },
  { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, permission: ["roles.view"] },
  { href: "/admin/activity", label: "Activity Log", icon: Activity, permission: ["activity_logs.view"] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const staff = useStaff();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-6" />
          </button>
          <span className="font-heading text-xl lg:hidden">SHOP.CO</span>
          <ThemeToggle className="ml-auto mr-2 hidden sm:inline-flex" />
          <Link href="/admin/profile" className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-surface max-sm:ml-auto">
            <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">{staff.name.charAt(0).toUpperCase()}</span>
            <span className="hidden text-left text-sm leading-tight sm:block">
              <span className="block font-medium">{staff.name}</span>
              <span className="block text-xs text-ink/50">{staff.roles.map((r) => r.name).join(", ")}</span>
            </span>
          </Link>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const can = useCan();
  const router = useRouter();
  const client = useQueryClient();

  const logout = async () => {
    await api("admin/auth/logout", { method: "POST" }).catch(() => undefined);
    client.clear();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Admin">
      <Link href="/admin" onClick={onNavigate} className="mb-6 px-3 pt-2">
        <span className="font-heading text-2xl">SHOP.CO</span>
        <span className="ml-2 rounded bg-ink px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-white">Admin</span>
      </Link>
      {NAV.filter((item) => can(...item.permission)).map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-ink text-white" : "text-ink/70 hover:bg-surface hover:text-ink")}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <ThemeToggle className="mx-3 mb-2 self-start sm:hidden" />
        <Link href="/" target="_blank" className="rounded-xl px-3 py-2 text-sm text-ink/60 hover:bg-surface">
          View storefront ↗
        </Link>
        <button type="button" onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink/70 hover:bg-surface hover:text-ink">
          <LogOut className="size-[18px]" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
