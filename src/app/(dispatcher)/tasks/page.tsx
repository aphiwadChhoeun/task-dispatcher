import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TaskFiltersBar } from "@/features/tasks/components/task-filters";
import { TaskList } from "@/features/tasks/components/task-card";
import { TaskKanban } from "@/features/tasks/components/task-kanban";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTaskerOptions, listTasks, unreadCountsForUser } from "@/features/tasks/queries";
import { taskFiltersFromSearchParams, taskFiltersToQuery } from "@/features/tasks/schemas";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireDispatcher();
  const params = await searchParams;
  const filters = taskFiltersFromSearchParams(params);
  const view = filters.view ?? "list";
  const db = getDb();
  const [tasks, taskers, unread] = await Promise.all([
    listTasks(db, user.orgId, { ...filters, view }),
    listTaskerOptions(db, user.orgId),
    unreadCountsForUser(db, user.orgId, user.id),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} in this view`}
        actions={
          <Link href="/tasks/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            New task
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border/80 bg-muted/60 p-0.5 text-xs font-medium">
          <Link
            href={`/tasks${taskFiltersToQuery(filters, "list")}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              view === "list"
                ? "bg-card text-foreground shadow-[0_1px_2px_rgb(18_26_22/0.08)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </Link>
          <Link
            href={`/tasks${taskFiltersToQuery(filters, "kanban")}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              view === "kanban"
                ? "bg-card text-foreground shadow-[0_1px_2px_rgb(18_26_22/0.08)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban
          </Link>
        </div>
      </div>

      <TaskFiltersBar action="/tasks" filters={filters} taskers={taskers} view={view} />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          description="Adjust the filters or create the first task for your team."
          action={
            <Link href="/tasks/new" className={buttonVariants({ size: "sm" })}>
              Create task
            </Link>
          }
        />
      ) : view === "kanban" ? (
        <TaskKanban tasks={tasks} />
      ) : (
        <TaskList tasks={tasks} unread={unread} hrefBase="/tasks" />
      )}
    </div>
  );
}
