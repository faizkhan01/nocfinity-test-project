import Link from "next/link";
import { Suspense } from "react";
import { apiGet } from "@/lib/api/server";
import type { Category } from "@/lib/types";
import { HeaderActions } from "./header-actions";
import { DesktopNav, MobileNav } from "./main-nav";
import { SearchBox } from "./search-box";

export async function Header() {
  const categories = await apiGet<{ data: Category[] }>("categories", { revalidate: 300 })
    .then((r) => r.data)
    .catch(() => []);

  return (
    <header className="relative bg-white">
      <div className="container-shop flex h-16 items-center gap-4 sm:h-24 lg:gap-10">
        <MobileNav categories={categories} />
        <Link href="/" className="font-heading text-[25px] sm:text-[32px]" aria-label="SHOP.CO home">
          SHOP.CO
        </Link>
        <DesktopNav categories={categories} />
        <Suspense fallback={<div className="hidden flex-1 lg:block" />}>
          <SearchBox className="hidden flex-1 lg:flex" />
        </Suspense>
        <div className="ml-auto lg:ml-0">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
