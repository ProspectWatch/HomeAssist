import { cn } from "@/lib/utils";

export function TopBar({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-surface-200 bg-surface-50/95 px-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-surface-50/80",
        className,
      )}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <h1 className="text-xl font-semibold tracking-tight text-surface-900">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm text-surface-500">{subtitle}</p> : null}
    </header>
  );
}
