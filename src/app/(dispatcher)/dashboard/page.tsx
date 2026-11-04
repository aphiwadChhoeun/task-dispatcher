import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ClipboardList,
  MapPin,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TaskFiltersBar } from "@/features/tasks/components/task-filters";
import { TaskKanban } from "@/features/tasks/components/task-kanban";
import { TaskList } from "@/features/tasks/components/task-card";
import { LiveMap } from "@/features/location/components/live-map";
import { GrievanceCard } from "@/features/grievances/components/grievance-card";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import {
  getDashboardStats,
  listActiveTasksForMap,
  listPresence,
  listTaskerOptions,
  listTasks,
  unreadCountsForUser,
} from "@/features/tasks/queries";
import { taskFiltersFromSearchParams, taskFiltersToQuery } from "@/features/tasks/schemas";
import { listGrievances } from "@/features/grievances/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireDispatcher();
  const params = await searchParams;
  const filters = taskFiltersFromSearchParams(params);
  const view = filters.view ?? "kanban";
  const db = getDb();

  const [tasks, taskers, presence, stats, unread, openGrievances] = await Promise.all([
    listTasks(db, user.orgId, { ...filters, view }),
    listTaskerOptions(db, user.orgId),
    listPresence(db, user.orgId),
    getDashboardStats(db, user.orgId),
    unreadCountsForUser(db, user.orgId, user.id),
    listGrievances(db, user.orgId, { status: "open_queue" }),
  ]);

  const activeTasks = await listActiveTasksForMap(db, user.orgId);
  const mapTasks = activeTasks
    .filter((row) => row.task.lat != null && row.task.lng != null)
    .map((row) => ({
      id: row.task.id,
      title: row.task.title,
      status: row.task.status,
      priority: row.task.priority,
      taskerId: row.task.taskerId,
      lat: row.task.lat as number,
      lng: row.task.lng as number,
      addressCity: row.task.addressCity,
      addressStreet: row.task.addressStreet,
    }));

  const statCards = [
    {
      label: "Active tasks",
      value: (stats.byStatus.assigned ?? 0) + (stats.byStatus.accepted ?? 0) + (stats.byStatus.en_route ?? 0) + (stats.byStatus.in_progress ?? 0) + (stats.byStatus.on_hold ?? 0),
      icon: ClipboardList,
      href: "/tasks?status=active",
    },
    {
      label: "In the field",
      value: (stats.byStatus.en_route ?? 0) + (stats.byStatus.in_progress ?? 0),
      icon: Activity,
      href: "/tasks?status=in_progress",
    },
    {
      label: "Sharing location",
      value: stats.sharingNow,
      icon: MapPin,
      href: "/live",
    },
    {
      label: "Open grievances",
      value: stats.openGrievances,
      icon: ShieldAlert,
      href: "/grievances?status=open_queue",
    },
    {
      label: "Active taskers",
      value: stats.activeTaskers,
      icon: Users,
      href: "/taskers",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dispatch console"
        title="Today at a glance"
        description={formatDateTime(new Date())}
        actions={
          <Link href="/tasks/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            New task
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group relative overflow-hidden rounded-2xl border border-border/85 bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lift"
            >
              <span className="stat-sheen absolute inset-0" aria-hidden />
              <div className="relative flex items-start justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="relative mt-4 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {stat.value}
              </p>
              <p className="relative mt-1.5 text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="live-heading">
        <SectionHeading
          id="live-heading"
          title="Live field map"
          action={
            <Link href="/live" className="text-xs font-semibold text-primary hover:underline">
              Full map
            </Link>
          }
        />
        <div className="overflow-hidden rounded-2xl shadow-card">
          <LiveMap initialPresence={presence} tasks={mapTasks} />
        </div>
      </section>

      <section aria-labelledby="tasks-heading" className="space-y-3">
        <SectionHeading
          id="tasks-heading"
          title="Tasks"
          action={
            <div className="flex rounded-lg border border-border/80 bg-muted/60 p-0.5 text-xs font-medium">
              <Link
                href={`/dashboard${taskFiltersToQuery(filters, "kanban")}`}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  view === "kanban"
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgb(18_26_22/0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Kanban
              </Link>
              <Link
                href={`/dashboard${taskFiltersToQuery(filters, "list")}`}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  view === "list"
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgb(18_26_22/0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                List
              </Link>
            </div>
          }
        />

        <TaskFiltersBar action="/dashboard" filters={filters} taskers={taskers} view={view} />

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks match these filters"
            description="Try clearing filters or create a new task."
            action={
              <Link href="/tasks/new" className={buttonVariants({ size: "sm" })}>
                Create task
              </Link>
            }
          />
        ) : view === "list" ? (
          <TaskList tasks={tasks} unread={unread} hrefBase="/tasks" />
        ) : (
          <TaskKanban tasks={tasks} />
        )}
      </section>

      <section aria-labelledby="grievances-heading">
        <SectionHeading
          id="grievances-heading"
          title="Grievance queue"
          action={
            <Link href="/grievances" className="text-xs font-semibold text-primary hover:underline">
              View queue
            </Link>
          }
        />
        {openGrievances.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <ShieldAlert className="size-4" aria-hidden />
              No open grievances.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {openGrievances.slice(0, 4).map((row) => (
              <GrievanceCard key={row.grievance.id} row={row} href={`/grievances/${row.grievance.id}`} />
            ))}
          </div>
        )}
      </section>

      <Card className="stat-sheen">
        <CardHeader className="pb-2">
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/announcements" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Send a broadcast
          </Link>
          <Link href="/taskers" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Manage taskers
          </Link>
          <Link href="/live" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open live map
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
