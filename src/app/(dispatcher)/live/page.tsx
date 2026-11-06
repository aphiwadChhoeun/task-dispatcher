import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { LiveMap } from "@/features/location/components/live-map";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listActiveTasksForMap, listPresence } from "@/features/tasks/queries";
import { formatLastSeen } from "@/lib/format";

export const metadata: Metadata = { title: "Live map" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const { user } = await requireDispatcher();
  const db = getDb();
  const [presence, activeTasks] = await Promise.all([
    listPresence(db, user.orgId),
    listActiveTasksForMap(db, user.orgId),
  ]);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live map"
        description={`${presence.length} tasker${presence.length === 1 ? "" : "s"} sharing location · updates arrive live over WebSocket`}
      />
      <LiveMap 
        initialPresence={presence}
        tasks={mapTasks}
        className="[&>div:first-child]:h-[60vh] [&>div:first-child]:sm:h-[68vh]"
        emptyMessage="No tasker is sharing location right now. Sharing starts when a task moves to En route."
      />
      <SectionHeading title="On the map" action={<span className="text-xs tabular-nums text-muted-foreground">{presence.length} sharing</span>} />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {presence.map((item) => (
          <div
            key={item.taskerId}
            className="rounded-2xl border border-border/85 bg-card p-4 text-sm shadow-card transition-colors hover:border-primary/20"
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/taskers/${item.taskerId}`}
                className="flex min-w-0 items-center gap-2.5 font-semibold tracking-[-0.01em] hover:underline"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-black/10"
                  style={{ background: item.color }}
                  aria-hidden
                >
                  {item.taskerName.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{item.taskerName}</span>
              </Link>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  item.stale ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                }`}
              >
                <span className={`size-1.5 rounded-full ${item.stale ? "bg-warning" : "bg-success"}`} aria-hidden />
                {item.stale ? "Stale" : "Live"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {item.taskTitle ?? "No active task"} · {formatLastSeen(item.updatedAt)}
            </p>
            <Link
              href={`/taskers/${item.taskerId}`}
              className="mt-2.5 inline-block text-xs font-semibold text-primary hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
            >
              View profile
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
