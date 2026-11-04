import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ALERT_ICONS = {
  info: Info,
  error: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
} as const;

export function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "info" | "error" | "success" | "warning";
}) {
  const Icon = ALERT_ICONS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed",
        variant === "info" && "border-border bg-muted/60 text-foreground",
        variant === "error" && "border-destructive/20 bg-destructive/[0.055] text-destructive",
        variant === "success" && "border-success/20 bg-success/[0.055] text-success",
        variant === "warning" && "border-warning/20 bg-warning/[0.06] text-warning",
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/45 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-card text-muted-foreground shadow-card">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[0.95rem] font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
