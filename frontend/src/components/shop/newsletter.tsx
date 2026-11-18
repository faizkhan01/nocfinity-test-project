"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MailIcon } from "@/components/icons";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("newsletter", { method: "POST", body: { email } });
      toast.success("You're subscribed. Watch your inbox for our latest offers.");
      setEmail("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 rounded-card bg-ink px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-16 lg:py-9">
      <h2 className="max-w-[551px] font-heading text-[32px] leading-[35px] text-white lg:text-[40px] lg:leading-[45px]">
        Stay upto date about our latest offers
      </h2>
      <form onSubmit={submit} className="flex w-full flex-col gap-3 lg:w-[349px] lg:gap-[14px]">
        <label className="flex items-center gap-3 rounded-pill bg-white px-4 py-3">
          <MailIcon className="size-5 shrink-0 text-ink/40 sm:size-6" />
          <span className="sr-only">Email address</span>
          <input
            type="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40 sm:text-base"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-white px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-60 sm:text-base"
        >
          Subscribe to Newsletter
        </button>
      </form>
    </div>
  );
}
