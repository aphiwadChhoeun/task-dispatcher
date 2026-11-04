import * as React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Flame,
  PauseCircle,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/features/tasks/state-machine";
import type { TaskPriority, TaskStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TaskStatus, { variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "muted"; icon: React.ElementType }> = {
  assigned: { variant: "secondary", icon: CircleDashed },
  accepted: { variant: "default", icon: CheckCircle2 },
  en_route: { variant: "warning", icon: Truck },
  in_progress: { variant: "warning", icon: Wrench },
  completed: { variant: "success", icon: CheckCircle2 },
  rejected: { variant: "destructive", icon: XCircle },
  cancelled: { variant: "muted", icon: Ban },
  on_hold: { variant: "muted", icon: PauseCircle },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <Badge variant={style.variant} className={className}>
      <Icon className="size-3.5" aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY_STYLES: Record<TaskPriority, { variant: "muted" | "secondary" | "warning" | "destructive"; icon: React.ElementType }> = {
  low: { variant: "muted", icon: ArrowDown },
  normal: { variant: "secondary", icon: ArrowRight },
  high: { variant: "warning", icon: ArrowUp },
  urgent: { variant: "destructive", icon: Flame },
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const style = PRIORITY_STYLES[priority];
  const Icon = style.icon;
  return (
    <Badge variant={style.variant} className={cn("capitalize", className)}>
      <Icon className="size-3.5" aria-hidden />
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function GrievanceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "muted" }> = {
    open: { label: "Open", variant: "destructive" },
    under_review: { label: "Under review", variant: "warning" },
    resolved: { label: "Resolved", variant: "success" },
    rejected: { label: "Rejected", variant: "muted" },
  };
  const item = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === "high" ? "destructive" : severity === "medium" ? "warning" : "muted";
  return <Badge variant={variant} className="capitalize">{severity}</Badge>;
}

export function SeenBadge({ updatedAt }: { updatedAt: Date | string | number | null }) {
  const date = updatedAt ? new Date(updatedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return (
    <Badge variant="outline">
      <Clock className="size-3.5" aria-hidden />
      {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </Badge>
  );
}
