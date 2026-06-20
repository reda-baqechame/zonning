"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-brand text-brand-ink shadow-sm hover:bg-brand-hover focus:ring-ring active:scale-[0.98]",
  secondary:
    "border border-line bg-surface text-ink shadow-sm hover:border-line-strong hover:bg-surface-hover focus:ring-ring",
  ghost: "text-muted hover:bg-surface-hover hover:text-ink focus:ring-ring",
  success:
    "border border-success/20 bg-success-soft text-success-ink hover:border-success/40 focus:ring-success/30",
  destructive: "bg-danger text-white hover:bg-red-600 focus:ring-danger/30",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm font-semibold",
  lg: "px-6 py-3 text-base font-semibold",
} as const;

export type ButtonVariant = keyof typeof variants;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: keyof typeof sizes;
  }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg transition focus:outline-none focus:ring-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
