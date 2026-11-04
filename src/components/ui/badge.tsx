import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 tracking-[0.005em] whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary/10 bg-primary/[0.08] text-primary",
        secondary: "border-secondary-foreground/[0.06] bg-secondary text-secondary-foreground",
        outline: "border-border bg-card/80 text-foreground/85",
        destructive: "border-destructive/10 bg-destructive/[0.08] text-destructive",
        success: "border-success/10 bg-success/[0.08] text-success",
        warning: "border-warning/10 bg-warning/[0.09] text-warning",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
