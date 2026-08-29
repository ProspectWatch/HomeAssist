import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-[6px] px-2 py-0.5 text-[10px] font-bold", {
  variants: {
    variant: {
      neutral: "bg-cream text-ink",
      oak: "bg-oak/15 text-walnut",
      green: "bg-green text-white",
      deal: "bg-green text-white",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
