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
    <div className={cn("px-5 py-9 text-center text-[13px] text-muted", className)}>
      {Icon ? <Icon className="mx-auto mb-2 h-7 w-7 text-muted2" aria-hidden="true" /> : null}
      {title ? <p className="font-medium text-charcoal">{title}</p> : null}
      {description ? <p className="mt-1">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
