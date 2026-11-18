"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";

const STORAGE_KEY = "shop:promo-dismissed";

export function AnnouncementBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage can be blocked; the bar simply stays visible.
    }
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  return (
    <div className="bg-ink text-white">
      <div className="container-shop relative flex h-[34px] items-center justify-center sm:h-[38px]">
        <p className="text-xs sm:text-sm">
          Sign up and get 20% off to your first order.{" "}
          <Link href="/register" className="font-medium underline">
            Sign Up Now
          </Link>
        </p>
        <button type="button" onClick={dismiss} aria-label="Dismiss announcement" className="absolute right-4 hidden sm:block">
          <CloseIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
