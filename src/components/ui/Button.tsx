"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-sky-500 text-white hover:bg-sky-400 focus:ring-sky-500/40 active:scale-[0.98]",
  secondary:
    "border border-slate-600 bg-slate-900/50 text-slate-200 hover:border-slate-500 hover:bg-slate-800 focus:ring-slate-500/30",
  ghost: "text-slate-300 hover:bg-slate-800 hover:text-white focus:ring-slate-500/30",
  success:
    "border border-emerald-600/50 bg-emerald-950/30 text-emerald-300 hover:border-emerald-500 focus:ring-emerald-500/30",
  destructive: "bg-red-600/90 text-white hover:bg-red-500 focus:ring-red-500/40",
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
