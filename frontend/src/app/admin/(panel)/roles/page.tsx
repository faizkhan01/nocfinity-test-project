import type { Metadata } from "next";
import { RolesMatrix } from "@/components/admin/roles";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default function Page() {
  return <RolesMatrix />;
}
