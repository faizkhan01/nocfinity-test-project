import { ForgotPasswordForm } from "@/components/shop/auth/password-reset-forms";

export default function AdminForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-6 mt-6 text-xl font-bold">Reset your password</h1>
      <ForgotPasswordForm scope="admin" />
    </>
  );
}
