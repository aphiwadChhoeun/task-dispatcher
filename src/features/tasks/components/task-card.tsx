import Link from "next/link";
import { CalendarClock, MapPin, MessageSquare, UserRound } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import type { TaskWithTasker } from "@/features/tasks/queries";
import { formatAddress, formatWindow } from "@/lib/format";
import { cn, initials } from "@/lib/utils";

export function TaskCard({
  task,
  href,
  unreadCount = 0,
  highlight = false,
  compact = false,
}: {
  task: TaskWithTasker;
  href: string;
  unreadCount?: number;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        highlight
          ? "border-primary/35 bg-[linear-gradient(180deg,rgb(13_95_76/0.045),transparent_55%)] ring-1 ring-primary/10"
          : "border-border/85",
        compact && "p-3.5",
      )}
    >
      {highlight ? (
        <span className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,var(--primary),transparent)]" aria-hidden />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {highlight ? <Badge variant="default">New</Badge> : null}
            {unreadCount > 0 ? (
              <Badge variant="destructive" aria-label={`${unreadCount} unread messages`}>
                <MessageSquare className="size-3" aria-hidden />
                {unreadCount}
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
            {task.title}
          </h3>
        </div>
      </div>

      <dl className="mt-3.5 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-start gap-1.5">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
          <dd>{formatWindow(task.scheduledStart, task.scheduledEnd)}</dd>
        </div>
        <div className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
          <dd className="line-clamp-1">
            {formatAddress(task) || "No address"}
            {task.addressCity ? ` · ${task.addressCity}` : ""}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          {task.taskerId ? (
            <>
              <span
                className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-black/10"
                style={{ background: task.taskerColor ?? "#0f766e" }}
                aria-hidden
              >
                {initials(task.taskerName ?? "?")}
              </span>
              <dd className="truncate">{task.taskerName ?? "Tasker"}</dd>
            </>
          ) : (
            <>
              <UserRound className="size-3.5 opacity-80" aria-hidden />
              <dd>Unassigned</dd>
            </>
          )}
        </div>
      </dl>
    </Link>
  );
}

export function TaskList({
  tasks,
  unread,
  hrefBase = "/tasks",
  empty,
}: {
  tasks: TaskWithTasker[];
  unread?: Map<string, number>;
  hrefBase?: string;
  empty?: React.ReactNode;
}) {
  if (tasks.length === 0) return <>{empty}</>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          href={`${hrefBase}/${task.id}`}
          unreadCount={unread?.get(task.id) ?? 0}
        />
      ))}
    </div>
  );
}
