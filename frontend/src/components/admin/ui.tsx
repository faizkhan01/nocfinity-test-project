"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-surface/60 text-xs uppercase tracking-wide text-ink/50">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-ink/50">
        {children}
      </td>
    </tr>
  );
}

export function LoadingRows({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="h-5 animate-pulse rounded bg-surface" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Modal({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative my-8 w-full rounded-2xl bg-white p-6 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-surface">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Select({ label, className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {label && <span className="font-medium">{label}</span>}
      <select className="h-10 rounded-xl border border-line bg-white px-3 outline-none focus:ring-2 focus:ring-ink" {...props}>
        {children}
      </select>
    </label>
  );
}

export function TextInput({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {label && <span className="font-medium">{label}</span>}
      <input
        aria-invalid={Boolean(error)}
        className={cn("h-10 rounded-xl border border-line bg-white px-3 outline-none focus:ring-2 focus:ring-ink disabled:bg-surface", error && "border-sale")}
        {...props}
      />
      {error && <span className="text-xs text-sale">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", checked ? "bg-ink" : "bg-ink/20")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "green" | "red" | "amber" | "blue"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-surface text-ink/70",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function SimplePager({ page, last, onChange }: { page: number; last: number; onChange: (p: number) => void }) {
  if (last <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-ink/60">
        Page {page} of {last}
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
          Previous
        </button>
        <button type="button" disabled={page >= last} onClick={() => onChange(page + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}
