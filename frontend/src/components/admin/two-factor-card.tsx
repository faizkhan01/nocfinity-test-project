"use client";

import { Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { TwoFactorSetup } from "@/lib/types";
import { useStaff } from "./staff-context";
import { Badge, Card, TextInput } from "./ui";

type Step = "idle" | "password" | "scan" | "codes" | "disable" | "regenerate";

export function TwoFactorCard() {
  const staff = useStaff();
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors())[0] ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setSetup(null);
    setError(null);
  };

  const start = () =>
    run(async () => {
      setSetup((await api<{ data: TwoFactorSetup }>("admin/two-factor", { method: "POST", body: { password } })).data);
      setPassword("");
      setStep("scan");
    });

  const confirm = () =>
    run(async () => {
      setCodes((await api<{ data: { recovery_codes: string[] } }>("admin/two-factor/confirm", { method: "POST", body: { code: code.replace(/\s/g, "") } })).data.recovery_codes);
      setStep("codes");
      toast.success("Two-factor authentication is on");
    });

  const disable = () =>
    run(async () => {
      await api("admin/two-factor", { method: "DELETE", body: { password } });
      toast.success("Two-factor authentication turned off");
      reset();
      router.refresh();
    });

  const regenerate = () =>
    run(async () => {
      setCodes((await api<{ data: { recovery_codes: string[] } }>("admin/two-factor/recovery-codes", { method: "POST", body: { password } })).data.recovery_codes);
      setPassword("");
      setStep("codes");
    });

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Recovery codes copied");
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([`SHOP.CO admin recovery codes for ${staff.email}\n\n${codes.join("\n")}\n`], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "shopco-recovery-codes.txt" });
    link.click();
    URL.revokeObjectURL(url);
  };

  const passwordForm = (label: string, onSubmit: () => void, danger = false) => (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextInput label="Confirm your password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant={danger ? "danger" : "primary"} loading={busy} disabled={!password}>
          {label}
        </Button>
      </div>
    </form>
  );

  return (
    <Card className="flex flex-col gap-4 p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          {staff.two_factor_enabled ? <ShieldCheck className="size-5 text-emerald-600" /> : <ShieldOff className="size-5 text-ink/40" />}
          Two-factor authentication
        </h2>
        {staff.two_factor_enabled || step === "codes" ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Not enabled</Badge>}
      </div>
      <p className="text-sm text-ink/60">
        After your password, sign-in also asks for a code from an authenticator app (Google Authenticator, 1Password, Authy…), so a leaked
        password alone can&apos;t open the admin panel.
      </p>

      {step === "idle" &&
        (staff.two_factor_enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setStep("regenerate")}>
              New recovery codes
            </Button>
            <Button size="sm" variant="outline" className="text-sale" onClick={() => setStep("disable")}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button size="sm" className="self-start" onClick={() => setStep("password")}>
            Set up two-factor authentication
          </Button>
        ))}

      {step === "password" && passwordForm("Continue", start)}
      {step === "disable" && passwordForm("Turn off 2FA", disable, true)}
      {step === "regenerate" && passwordForm("Generate new codes", regenerate)}

      {step === "scan" && setup && (
        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered QR data URI */}
          <img src={setup.qr_code} alt="QR code to add this account to your authenticator app" width={200} height={200} className="rounded-xl bg-white p-2" />
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
              <li>Scan the QR code with your authenticator app.</li>
              <li>
                Can&apos;t scan? Enter this key: <code className="break-all rounded bg-surface px-1.5 py-0.5 text-xs">{setup.secret}</code>
              </li>
              <li>Type the 6-digit code it shows.</li>
            </ol>
            <TextInput
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            />
            <FormError message={error} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>
                Confirm and turn on
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === "codes" && (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Save these recovery codes somewhere safe. Each one signs you in once if you lose your phone. They won&apos;t be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-4 font-mono text-sm sm:grid-cols-4">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copyCodes}>
              <Copy className="size-4" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={downloadCodes}>
              <Download className="size-4" /> Download
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCodes([]);
                reset();
                router.refresh();
              }}
            >
              I&apos;ve saved them
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
