import type { Metadata } from "next";
import { CategoriesView } from "@/components/admin/categories";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return <CategoriesView />;
}
