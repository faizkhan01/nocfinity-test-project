import Link from "next/link";
import { cn } from "@/lib/format";

type Variant = "primary" | "outline" | "soft" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85",
  outline: "border border-line bg-white text-ink hover:bg-surface",
  soft: "bg-surface text-ink/60 hover:bg-ink/10 hover:text-ink",
  danger: "bg-sale text-[#fff] hover:bg-sale/90",
  ghost: "text-ink hover:bg-surface",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm sm:h-12 sm:text-base",
  lg: "h-[52px] px-14 text-base",
};

type Common = { variant?: Variant; size?: Size; className?: string };

export function buttonClasses({ variant = "primary", size = "md", className }: Common = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  loading,
  children,
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button className={buttonClasses({ variant, size, className })} disabled={loading || props.disabled} {...props}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...props }: Common & React.ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
