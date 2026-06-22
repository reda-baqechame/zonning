import { cn } from "@/lib/cn";

const variants = {
  default: "border-line bg-surface-2 text-muted",
  primary: "border-brand-border bg-brand-soft text-brand",
  success: "border-success/20 bg-success-soft text-success-ink",
  warning: "border-warning/20 bg-warning-soft text-warning-ink",
  error: "border-danger/20 bg-danger-soft text-danger-ink",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
