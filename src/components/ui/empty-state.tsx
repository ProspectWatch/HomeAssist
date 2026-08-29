import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-(--radius-lg) border border-dashed border-surface-300 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-surface-400" aria-hidden="true" /> : null}
      <p className="text-sm font-medium text-surface-700">{title}</p>
      {description ? <p className="text-sm text-surface-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
