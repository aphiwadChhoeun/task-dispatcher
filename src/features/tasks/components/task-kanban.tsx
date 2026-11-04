import Link from "next/link";
import { StatusBadge } from "@/components/status-badges";
import type { TaskWithTasker } from "@/features/tasks/queries";
import { TASK_STATUSES } from "@/features/tasks/state-machine";
import type { TaskStatus } from "@/lib/db/schema";
import { formatTime } from "@/lib/format";

const KANBAN_COLUMNS: TaskStatus[] = [
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "on_hold",
  "completed",
];

const COLUMN_ACCENT: Partial<Record<TaskStatus, string>> = {
  assigned: "bg-slate-400/70",
  accepted: "bg-primary/70",
  en_route: "bg-warning/70",
  in_progress: "bg-warning/80",
  on_hold: "bg-muted-foreground/50",
  completed: "bg-success/70",
};

export function TaskKanban({ tasks }: { tasks: TaskWithTasker[] }) {
  const grouped = new Map<TaskStatus, TaskWithTasker[]>();
  for (const status of TASK_STATUSES) grouped.set(status, []);
  for (const task of tasks) grouped.get(task.status)?.push(task);

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {KANBAN_COLUMNS.map((status) => {
        const items = grouped.get(status) ?? [];
        return (
          <section
            key={status}
            className="w-[286px] shrink-0 snap-start rounded-2xl border border-border/80 bg-muted/30 p-2"
            aria-label={`${status} tasks`}
          >
            <div className={`mx-1 mb-2 h-[2px] w-8 rounded-full ${COLUMN_ACCENT[status] ?? "bg-border"}`} aria-hidden />
            <header className="flex items-center justify-between gap-2 px-1 py-1.5">
              <StatusBadge status={status} />
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/70">
                {items.length}
              </span>
            </header>
            <div className="mt-1.5 space-y-2">
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/90 px-3 py-7 text-center text-xs text-muted-foreground">
                  Nothing here
                </p>
              ) : (
                items.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-xl border border-border/85 bg-card p-3 text-sm shadow-[0_1px_2px_rgb(18_26_22/0.04)] transition-all duration-150 hover:border-primary/25 hover:shadow-card"
                  >
                    <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{task.title}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {formatTime(task.scheduledStart)} · {task.taskerName ?? "Unassigned"}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
