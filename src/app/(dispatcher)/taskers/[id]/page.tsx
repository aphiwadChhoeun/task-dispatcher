import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TaskCard } from "@/features/tasks/components/task-card";
import { TaskerEditForm } from "@/features/taskers/components/tasker-edit-form";
import { ResendInviteForm, TaskerStatusForm } from "@/features/taskers/components/tasker-status-form";
import { LiveMap } from "@/features/location/components/live-map";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { getPresenceForTasker, getTaskerProfile, listTasks } from "@/features/tasks/queries";
import { formatLastSeen, formatRelative } from "@/lib/format";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Tasker profile" };
export const dynamic = "force-dynamic";

export default async function TaskerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireDispatcher();
  const { id } = await params;
  const db = getDb();
  const tasker = await getTaskerProfile(db, user.orgId, id);
  if (!tasker) notFound();

  const [tasks, presence] = await Promise.all([
    listTasks(db, user.orgId, { taskerId: tasker.id }, 200),
    getPresenceForTasker(db, user.orgId, tasker.id),
  ]);
  const activeTasks = tasks.filter((task) =>
    ["assigned", "accepted", "en_route", "in_progress", "on_hold"].includes(task.status),
  );

  return (
    <div className="space-y-5">
      <Link href="/taskers" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        All taskers
      </Link>
      <PageHeader
        eyebrow={tasker.status === "active" ? "Active tasker" : tasker.status}
        title={tasker.name}
        description={`${activeTasks.length} active task${activeTasks.length === 1 ? "" : "s"}`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="stat-sheen border-b border-border/70 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-4">
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold tracking-[-0.02em] text-white shadow-card ring-4 ring-card"
                  style={{ background: tasker.color }}
                  aria-hidden
                >
                  {initials(tasker.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h2 className="truncate text-[1.05rem] font-semibold tracking-[-0.02em]">
                      {tasker.name}
                    </h2>
                    <Badge
                      className="capitalize"
                      variant={
                        tasker.status === "active"
                          ? "success"
                          : tasker.status === "invited"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {tasker.status}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <a
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                      href={`mailto:${tasker.email}`}
                    >
                      <Mail className="size-3.5" aria-hidden />
                      {tasker.email}
                    </a>
                    {tasker.phone ? (
                      <a
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                        href={`tel:${tasker.phone}`}
                      >
                        <Phone className="size-3.5" aria-hidden />
                        {tasker.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                    Skills
                  </dt>
                  <dd className="mt-1 font-medium leading-relaxed">{parseSkills(tasker.skills) || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                    Vehicle
                  </dt>
                  <dd className="mt-1 font-medium leading-relaxed">{tasker.vehicle ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                    Availability
                  </dt>
                  <dd className="mt-1 font-medium leading-relaxed">{tasker.availability ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                    Joined
                  </dt>
                  <dd className="mt-1 font-medium leading-relaxed">{formatRelative(tasker.createdAt)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-border/70 pt-4">
                <TaskerStatusForm taskerId={tasker.id} status={tasker.status} />
                {tasker.status === "invited" ? <ResendInviteForm taskerId={tasker.id} /> : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Live location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {presence ? formatLastSeen(presence.updatedAt) : "No location has been shared yet."}
              </p>
              <LiveMap
                initialPresence={presence ? [presence] : []}
                onlyTaskerId={tasker.id}
                showTaskMarkers={false}
                emptyMessage="No location shared by this tasker yet."
              />
            </CardContent>
          </Card>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="section-label">Active tasks</h2>
              <Link href={`/tasks?taskerId=${tasker.id}&status=active`} className="text-xs font-semibold text-primary max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
                All tasks
              </Link>
            </div>
            {activeTasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-4 text-sm text-muted-foreground">
                No active tasks assigned.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {activeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} href={`/tasks/${task.id}`} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Edit profile</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskerEditForm
                tasker={{
                  id: tasker.id,
                  name: tasker.name,
                  email: tasker.email,
                  phone: tasker.phone,
                  skills: tasker.skills,
                  vehicle: tasker.vehicle,
                  availability: tasker.availability,
                  color: tasker.color,
                }}
              />
            </CardContent>
          </Card>
          <div className="mt-3">
            <Link href={`/tasks?taskerId=${tasker.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
              View full task history
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function parseSkills(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.join(", ") : raw;
  } catch {
    return raw;
  }
}
