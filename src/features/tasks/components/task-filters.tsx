import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { TASK_STATUS_LABELS, TASK_STATUSES } from "@/features/tasks/state-machine";
import type { TaskFilters } from "@/features/tasks/schemas";
import { cn } from "@/lib/utils";

type TaskerOption = { id: string; name: string; status: string };

export function TaskFiltersBar({
  action,
  filters,
  taskers,
  view,
  className,
}: {
  action: string;
  filters: TaskFilters;
  taskers: TaskerOption[];
  view?: string;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className={cn("grid gap-2.5 rounded-2xl border border-border/85 bg-card p-3.5 shadow-card sm:grid-cols-2 lg:grid-cols-6", className)}
    >
      {view ? <input type="hidden" name="view" value={view} /> : null}
      <div className="sm:col-span-2 lg:col-span-2">
        <label htmlFor="q" className="sr-only">
          Search tasks
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search title, address, customer…"
            className="pl-9"
          />
        </div>
      </div>
      <div>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <Select id="status" name="status" defaultValue={filters.status ?? "all"}>
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="taskerId" className="sr-only">
          Tasker
        </label>
        <Select id="taskerId" name="taskerId" defaultValue={filters.taskerId ?? ""}>
          <option value="">All taskers</option>
          {taskers.map((tasker) => (
            <option key={tasker.id} value={tasker.id}>
              {tasker.name}
              {tasker.status !== "active" ? ` (${tasker.status})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="priority" className="sr-only">
          Priority
        </label>
        <Select id="priority" name="priority" defaultValue={filters.priority ?? ""}>
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </div>
      <div>
        <label htmlFor="date" className="sr-only">
          Scheduled date
        </label>
        <Input id="date" name="date" type="date" defaultValue={filters.date ?? ""} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Link
          href={view ? `${action}?view=${view}` : action}
          className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
