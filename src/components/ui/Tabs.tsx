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
        "flex gap-1 overflow-x-auto border-b border-slate-800 pb-px scrollbar-none",
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
              ? "border-b-2 border-sky-500 bg-slate-900/50 text-white"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
