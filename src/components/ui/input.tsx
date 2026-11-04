import * as React from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "flex w-full rounded-[10px] border border-input/80 bg-card px-3 py-2 text-base text-foreground shadow-[inset_0_1px_2px_rgb(18_26_22/0.03)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/75 hover:border-input focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60 sm:text-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn("h-11", fieldClasses, className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("min-h-24 leading-relaxed", fieldClasses, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("select-field h-11 appearance-none pr-9", fieldClasses, className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
