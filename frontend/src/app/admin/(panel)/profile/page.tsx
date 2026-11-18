import type { Metadata } from "next";
import { ProfileForms } from "@/components/admin/profile-forms";

export const metadata: Metadata = { title: "My profile" };

export default function AdminProfilePage() {
  return <ProfileForms />;
}
