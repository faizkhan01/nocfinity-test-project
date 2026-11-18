"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "@/components/icons";
import type { Category } from "@/lib/types";

const LINKS = [
  { href: "/shop?on_sale=1", label: "On Sale" },
  { href: "/shop?sort=newest", label: "New Arrivals" },
  { href: "/#brands", label: "Brands" },
];

export function DesktopNav({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <nav className="hidden items-center gap-6 lg:flex">
      <div className="relative" ref={ref}>
        <button type="button" className="flex items-center gap-1" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Shop <ChevronDownIcon className="size-4" />
        </button>
        {open && (
          <div className="absolute left-0 top-9 z-40 grid w-[420px] grid-cols-2 gap-6 rounded-2xl border border-line bg-white p-6 shadow-lg">
            {categories.map((parent) => (
              <div key={parent.id}>
                <Link href={`/shop?category=${parent.slug}`} onClick={() => setOpen(false)} className="font-bold hover:underline">
                  {parent.name}
                </Link>
                <ul className="mt-2 space-y-1.5 text-ink/60">
                  {parent.children?.map((child) => (
                    <li key={child.id}>
                      <Link href={`/shop?category=${child.slug}`} onClick={() => setOpen(false)} className="hover:text-ink">
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link href="/shop" onClick={() => setOpen(false)} className="col-span-2 text-sm font-medium underline">
              View all products
            </Link>
          </div>
        )}
      </div>
      {LINKS.map((link) => (
        <Link key={link.label} href={link.href} className="hover:underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
        <MenuIcon className="size-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col gap-6 overflow-y-auto bg-white p-6">
            <div className="flex items-center justify-between">
              <span className="font-heading text-2xl">SHOP.CO</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                <CloseIcon className="size-6" />
              </button>
            </div>
            <Link href="/shop" onClick={() => setOpen(false)} className="text-lg font-bold">
              Shop all
            </Link>
            {categories.map((parent) => (
              <div key={parent.id}>
                <Link href={`/shop?category=${parent.slug}`} onClick={() => setOpen(false)} className="font-bold">
                  {parent.name}
                </Link>
                <ul className="mt-2 space-y-2 text-ink/60">
                  {parent.children?.map((child) => (
                    <li key={child.id}>
                      <Link href={`/shop?category=${child.slug}`} onClick={() => setOpen(false)}>
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-col gap-3 border-t border-line pt-6">
              {LINKS.map((link) => (
                <Link key={link.label} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
