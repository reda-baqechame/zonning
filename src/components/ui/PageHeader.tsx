import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted md:text-base">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
