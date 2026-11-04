import Link from "next/link";
import { MessageSquare, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GrievanceStatusBadge, SeverityBadge } from "@/components/status-badges";
import type { GrievanceRow } from "@/features/grievances/queries";
import { formatRelative, titleCase } from "@/lib/format";

export function GrievanceCard({
  row,
  href,
}: {
  row: GrievanceRow;
  href: string;
}) {
  const category = titleCase(row.grievance.category);
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border/85 bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <GrievanceStatusBadge status={row.grievance.status} />
        <SeverityBadge severity={row.grievance.severity} />
        <Badge variant="outline">{category}</Badge>
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
        {row.taskTitle ?? "Task grievance"}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {row.grievance.description}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5 opacity-80" aria-hidden />
          {row.taskerName ?? "Tasker"}
        </span>
        <span>{formatRelative(row.grievance.createdAt)}</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5 opacity-80" aria-hidden />
          {row.commentCount}
        </span>
        {row.assigneeName ? <span>Assigned to {row.assigneeName}</span> : null}
      </div>
    </Link>
  );
}
