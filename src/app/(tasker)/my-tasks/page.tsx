import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Megaphone, Plus, ShieldAlert } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TaskCard } from "@/features/tasks/components/task-card";
import { TaskerAlerts } from "@/features/tasks/components/tasker-alerts";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTasks, unreadCountsForUser } from "@/features/tasks/queries";
import { listAnnouncementsForTasker } from "@/features/announcements/queries";
import { hasTaskerLocationSharing } from "@/features/location/queries";
import { formatRelative } from "@/lib/format";
import type { TaskWithTasker } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "My tasks" };
export const dynamic = "force-dynamic";

const ACTIVE = ["assigned", "accepted", "en_route", "in_progress", "on_hold"];

export default async function MyTasksPage() {
  const { user } = await requireTasker();
  const db = getDb();
  const [tasks, unread, announcements] = await Promise.all([
    listTasks(db, user.orgId, { taskerId: user.id }, 200),
    unreadCountsForUser(db, user.orgId, user.id),
    listAnnouncementsForTasker(db, user.orgId, user.id, 5),
  ]);

  const active = tasks.filter((task) => ACTIVE.includes(task.status));
  const sortedActive = [...active].sort((a, b) => {
    const rank = (task: TaskWithTasker) => (task.status === "assigned" ? 0 : 1);
    return (
      rank(a) - rank(b) ||
      (a.scheduledStart?.getTime() ?? 0) - (b.scheduledStart?.getTime() ?? 0)
    );
  });
  const newestAssigned = [...tasks]
    .filter((task) => task.status === "assigned")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const closed = tasks
    .filter((task) => !ACTIVE.includes(task.status))
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  const sharing = await hasTaskerLocationSharing(db, user.orgId, user.id);

  return (
    <div className="space-y-5">
      <TaskerAlerts userId={user.id} />
      <PageHeader
        eyebrow="My tasks"
        title={`Hi, ${user.name.split(" ")[0]}`}
        description={
          active.length > 0
            ? `${active.length} active task${active.length === 1 ? "" : "s"}${sharing ? " · location sharing on" : ""}`
            : "You are all caught up."
        }
        actions={
          <Link href="/my-grievances" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ShieldAlert className="size-4" aria-hidden />
            Grievances
          </Link>
        }
      />

      {announcements.length > 0 ? (
        <section aria-labelledby="announcements-heading" className="space-y-2.5">
          <SectionHeading id="announcements-heading" title="Dispatch announcements" />
          {announcements.slice(0, 2).map(({ announcement, senderName, readAt }) => (
            <div
              key={announcement.id}
              className="relative overflow-hidden rounded-2xl border border-border/85 bg-card p-4 shadow-card"
            >
              {!readAt ? (
                <span className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,var(--accent),transparent)]" aria-hidden />
              ) : null}
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
                  <Megaphone className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{announcement.body}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {senderName ?? "Dispatch"} · {formatRelative(announcement.createdAt)}
                  </p>
                </div>
                {!readAt ? <Badge variant="default">New</Badge> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="active-heading" className="space-y-2.5">
        <SectionHeading
          id="active-heading"
          title="Active tasks"
          action={<span className="text-xs tabular-nums text-muted-foreground">{active.length}</span>}
        />
        {sortedActive.length === 0 ? (
          <EmptyState
            title="No active tasks"
            description="New assignments will appear here and trigger an alert."
            icon={<ClipboardList className="size-7" aria-hidden />}
          />
        ) : (
          <div className="space-y-3">
            {sortedActive.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                href={`/my-tasks/${task.id}`}
                unreadCount={unread.get(task.id) ?? 0}
                highlight={task.id === newestAssigned?.id}
              />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <details className="group rounded-2xl border border-border/85 bg-card p-4 shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Completed &amp; closed
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {closed.length}
            </span>
          </summary>
          <div className="mt-3.5 space-y-2">
            {closed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                href={`/my-tasks/${task.id}`}
                unreadCount={unread.get(task.id) ?? 0}
                compact
              />
            ))}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/my-grievances" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus className="size-4" aria-hidden />
          File a grievance
        </Link>
      </div>
    </div>
  );
}
