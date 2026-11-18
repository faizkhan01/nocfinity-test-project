import type { Metadata } from "next";
import { CouponsView } from "@/components/admin/coupons";

export const metadata: Metadata = { title: "Coupons" };

export default function AdminCouponsPage() {
  return <CouponsView />;
}
