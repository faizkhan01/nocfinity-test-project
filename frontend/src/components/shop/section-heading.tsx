import { cn } from "@/lib/format";

export function SectionHeading({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return <Tag className={cn("font-heading text-[32px] leading-[36px] sm:text-5xl sm:leading-[58px]", className)}>{children}</Tag>;
}
