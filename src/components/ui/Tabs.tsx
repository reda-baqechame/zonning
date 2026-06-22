"use client";

import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-line pb-px scrollbar-none",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition",
            active === tab.id
              ? "border-b-2 border-brand bg-brand-soft text-brand"
              : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
