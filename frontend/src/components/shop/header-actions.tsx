"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CartIcon, SearchIcon, UserIcon } from "@/components/icons";
import { useCart } from "@/hooks/use-cart";
import { customerKey, useCustomer } from "@/hooks/use-customer";
import { api } from "@/lib/api/client";
import { SearchBox } from "./search-box";

export function HeaderActions() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 sm:gap-[14px]">
        <button type="button" className="lg:hidden" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
          <SearchIcon className="size-6" />
        </button>
        <CartLink />
        <AccountMenu />
      </div>
      {searchOpen && (
        <div className="absolute inset-x-0 top-full z-30 border-b border-line bg-white px-4 py-3 lg:hidden">
          <Suspense>
            <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} />
          </Suspense>
        </div>
      )}
    </>
  );
}

function CartLink() {
  const { data } = useCart();
  const count = data?.item_count ?? 0;

  return (
    <Link href="/cart" className="relative" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      <CartIcon className="size-6" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 grid min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[10px] font-bold leading-[18px] text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function AccountMenu() {
  const { data: customer } = useCustomer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const client = useQueryClient();

  useEffect(() => {
    const close = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    await api("auth/logout", { method: "POST" }).catch(() => undefined);
    client.setQueryData(customerKey, null);
    await client.invalidateQueries({ queryKey: ["cart"] });
    setOpen(false);
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label="Account" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <UserIcon className="size-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-56 overflow-hidden rounded-2xl border border-line bg-white py-2 text-sm shadow-lg">
          {customer ? (
            <>
              <p className="truncate px-4 pb-2 pt-1 text-ink/60">Hi, {customer.name}</p>
              <MenuLink href="/account" onClick={() => setOpen(false)}>My account</MenuLink>
              <MenuLink href="/orders" onClick={() => setOpen(false)}>My orders</MenuLink>
              <button type="button" onClick={logout} className="block w-full px-4 py-2 text-left hover:bg-surface">
                Sign out
              </button>
            </>
          ) : (
            <>
              <MenuLink href="/login" onClick={() => setOpen(false)}>Sign in</MenuLink>
              <MenuLink href="/register" onClick={() => setOpen(false)}>Create account</MenuLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block px-4 py-2 hover:bg-surface">
      {children}
    </Link>
  );
}
