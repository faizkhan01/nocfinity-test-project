import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/shop/auth/password-reset-forms";

export default function AdminResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 mt-6 text-xl font-bold">Choose a new password</h1>
      <Suspense>
        <ResetPasswordForm scope="admin" />
      </Suspense>
    </>
  );
}
