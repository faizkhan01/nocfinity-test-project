"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/format";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string };

/** Labelled text input with an inline error, used by every storefront and admin form. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          "h-12 rounded-pill bg-surface px-5 text-base outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-ink",
          error && "ring-2 ring-sale",
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-ink/50">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-sale">
          {error}
        </p>
      )}
    </div>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, className, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn("min-h-28 rounded-[20px] bg-surface px-5 py-3 text-base outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-ink", error && "ring-2 ring-sale", className)}
        {...props}
      />
      {error && <p className="text-sm text-sale">{error}</p>}
    </div>
  );
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div role="alert" className="rounded-2xl bg-sale/10 px-4 py-3 text-sm text-sale">
      {message}
    </div>
  );
}
