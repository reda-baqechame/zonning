"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldClass, error && "border-danger/70 focus:ring-danger/30", className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }
>(function Textarea({ className, error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldClass, "min-h-[100px] resize-y", error && "border-danger/70", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }
>(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(fieldClass, error && "border-danger/70", className)}
      {...props}
    >
      {children}
    </select>
  );
});

export function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-danger">{message}</p>;
}
