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
    <header className={cn("px-5 pt-4 pb-3", className)}>
      <h1 className="font-serif text-[26px] leading-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
    </header>
  );
}
