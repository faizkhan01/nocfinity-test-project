import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/login-form";
import { hasSession } from "@/lib/api/server";

export default async function AdminLoginPage() {
  if (await hasSession("admin")) redirect("/admin");

  return (
    <>
      <h1 className="mt-6 text-xl font-bold">Staff sign in</h1>
      <p className="mt-1 text-sm text-ink/60">Use your staff account. Customer accounts cannot sign in here.</p>
      <Suspense>
        <AdminLoginForm />
      </Suspense>
      <Link href="/admin/forgot-password" className="mt-4 block text-center text-sm text-ink/60 underline">
        Forgot your password?
      </Link>
    </>
  );
}
