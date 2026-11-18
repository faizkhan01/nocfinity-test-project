"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { useApiForm } from "@/hooks/use-api-form";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { loginSchema, safeNext } from "@/lib/validation";

type LoginResult = { data: { two_factor_required?: boolean; challenge_token?: string } };

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [challenge, setChallenge] = useState<string | null>(null);
  const { form, formError, submitWith } = useApiForm(loginSchema, { defaultValues: { email: "", password: "" } });

  const finish = () => {
    const next = safeNext(params.get("next"), "/admin");
    router.replace(next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  };

  const onSubmit = submitWith(async (values) => {
    const result = await api<LoginResult>("admin/auth/login", { method: "POST", body: values });
    if (result.data.two_factor_required && result.data.challenge_token) setChallenge(result.data.challenge_token);
    else finish();
  });

  if (challenge) {
    return <TwoFactorStep challenge={challenge} onDone={finish} onRestart={() => (setChallenge(null), form.reset({ email: form.getValues("email"), password: "" }))} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <Input label="Email" type="email" autoComplete="username" {...form.register("email")} error={form.formState.errors.email?.message} />
      <Input label="Password" type="password" autoComplete="current-password" {...form.register("password")} error={form.formState.errors.password?.message} />
      <FormError message={formError} />
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

function TwoFactorStep({ challenge, onDone, onRestart }: { challenge: string; onDone: () => void; onRestart: () => void }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("admin/auth/two-factor-challenge", {
        method: "POST",
        body: { challenge_token: challenge, ...(useRecovery ? { recovery_code: value.trim() } : { code: value.replace(/\s/g, "") }) },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "challenge_expired") setExpired(true);
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors())[0] ?? err.message) : errorMessage(err));
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  if (expired) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <FormError message={error} />
        <Button size="lg" onClick={onRestart}>
          Sign in again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink/70">
        {useRecovery ? "Enter one of your recovery codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      {useRecovery ? (
        <Input label="Recovery code" autoComplete="one-time-code" autoFocus value={value} maxLength={20} onChange={(e) => setValue(e.target.value)} placeholder="xxxxx-xxxxx" />
      ) : (
        <Input
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={value}
          maxLength={7}
          onChange={(e) => setValue(e.target.value.replace(/[^\d ]/g, ""))}
          placeholder="123 456"
          className="text-center text-xl tracking-[0.4em]"
        />
      )}
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} disabled={useRecovery ? value.trim().length < 5 : value.replace(/\s/g, "").length !== 6}>
        Verify
      </Button>
      <button type="button" onClick={() => (setUseRecovery((v) => !v), setValue(""), setError(null))} className="text-center text-sm text-ink/60 underline">
        {useRecovery ? "Use your authenticator app instead" : "Lost your device? Use a recovery code"}
      </button>
    </form>
  );
}
