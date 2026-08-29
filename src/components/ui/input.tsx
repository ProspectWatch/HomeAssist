import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-11 w-full rounded-(--radius-md) border border-surface-300 bg-surface-0 px-3 text-sm text-surface-900 placeholder:text-surface-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
