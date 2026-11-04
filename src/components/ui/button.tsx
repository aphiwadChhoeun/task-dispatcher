import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-[-0.01em] transition-[background-color,box-shadow,transform,border-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-50 tap-target",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_10px_20px_-12px_rgb(13_95_76/0.85)] hover:bg-[#0a5140] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_14px_26px_-12px_rgb(13_95_76/0.9)]",
        secondary:
          "border border-border/80 bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] hover:bg-secondary/70",
        outline:
          "border border-input/90 bg-card text-foreground shadow-[0_1px_2px_rgb(18_26_22/0.04)] hover:border-primary/25 hover:bg-muted/50",
        ghost: "text-foreground hover:bg-muted/80",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_10px_20px_-12px_rgb(169_49_39/0.7)] hover:bg-[#92281f]",
        success:
          "bg-success text-success-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_10px_20px_-12px_rgb(26_115_80/0.75)] hover:bg-[#156043]",
        link: "text-primary underline-offset-4 hover:underline min-h-0 min-w-0",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 min-h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
