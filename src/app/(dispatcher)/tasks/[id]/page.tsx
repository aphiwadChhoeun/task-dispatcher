import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/page-header";
import { PriorityBadge, StatusBadge } from "@/components/status-badges";
import { TaskStatusActions } from "@/features/tasks/components/task-status-actions";
import { TaskTimeline } from "@/features/tasks/components/task-timeline";
import { TaskPhotoGallery } from "@/features/tasks/components/photo-gallery";
import { PhotoUpload } from "@/features/tasks/components/photo-upload";
import { AttachmentList } from "@/features/tasks/components/attachment-list";
import { AttachmentUpload } from "@/features/tasks/components/attachment-upload";
import { ReassignForm, DeleteTaskButton } from "@/features/tasks/components/task-admin-actions";
import { MessageThread } from "@/features/messaging/components/message-thread";
import { LiveMap } from "@/features/location/components/live-map";
import { getTaskConversation } from "@/features/messaging/service";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import {
  getPresenceForTasker,
  getTaskById,
  listTaskAttachments,
  listTaskEvents,
  listTaskerOptions,
  listTaskPhotos,
} from "@/features/tasks/queries";
import { getTransitionOptions } from "@/features/tasks/state-machine";
import { formatAddress, formatDateTime, formatWindow, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Task detail" };
export const dynamic = "force-dynamic";

export default async function DispatcherTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireDispatcher();
  const { id } = await params;
  const db = getDb();
  const task = await getTaskById(db, user.orgId, id);
  if (!task) notFound();

  const [events, photos, attachments, conversation, presence, taskers] = await Promise.all([
    listTaskEvents(db, user.orgId, task.id),
    listTaskPhotos(db, user.orgId, task.id),
    listTaskAttachments(db, user.orgId, task.id),
    getTaskConversation(user, task.id),
    task.taskerId ? getPresenceForTasker(db, user.orgId, task.taskerId) : Promise.resolve(null),
    listTaskerOptions(db, user.orgId),
  ]);

  const transitions = getTransitionOptions(
    task.status,
    { role: user.role, isAssignedTasker: task.taskerId === user.id },
    task.resumeStatus,
  );
  const shareLabel =
    task.status === "en_route" || task.status === "in_progress"
      ? "Location sharing is active for this task."
      : "Location sharing is paused while this task is not active.";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Task"
        title={task.title}
        description={formatWindow(task.scheduledStart, task.scheduledEnd)}
        actions={
          <>
            <Link href={`/tasks/${task.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Link>
            <DeleteTaskButton taskId={task.id} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <Badge variant="outline">{titleCase(task.type)}</Badge>
        <span className="text-xs text-muted-foreground">
          Created {formatDateTime(task.createdAt)} · Updated {formatDateTime(task.updatedAt)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskStatusActions taskId={task.id} taskTitle={task.title} transitions={transitions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Task details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {task.description ? <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p> : null}

              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5">
                    <UserRound className="size-4 text-muted-foreground" aria-hidden />
                    {task.taskerId ? (
                      <Link
                        href={`/taskers/${task.taskerId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {task.taskerName ?? "Tasker"}
                      </Link>
                    ) : (
                      "Unassigned"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Schedule</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {formatWindow(task.scheduledStart, task.scheduledEnd)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</dt>
                  <dd className="mt-0.5 flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    {formatAddress(task) || "No address"}
                  </dd>
                </div>
                {task.customerName || task.customerPhone ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</dt>
                    <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{task.customerName ?? "Customer"}</span>
                      {task.customerPhone ? (
                        <a className="inline-flex items-center gap-1 text-primary" href={`tel:${task.customerPhone}`}>
                          <Phone className="size-3.5" aria-hidden />
                          {task.customerPhone}
                        </a>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {task.instructions ? (
                <div>
                  <SectionHeading title="Instructions" className="mb-1" />
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{task.instructions}</p>
                </div>
              ) : null}
              {task.notes ? (
                <div>
                  <SectionHeading title="Internal notes" className="mb-1" />
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-muted-foreground">{task.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden />
                Live location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{shareLabel}</p>
              {task.taskerId ? (
                <LiveMap
                  initialPresence={presence ? [presence] : []}
                  tasks={
                    task.lat != null && task.lng != null
                      ? [
                          {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            priority: task.priority,
                            taskerId: task.taskerId,
                            lat: task.lat,
                            lng: task.lng,
                            addressCity: task.addressCity,
                            addressStreet: task.addressStreet,
                          },
                        ]
                      : []
                  }
                  onlyTaskerId={task.taskerId}
                  emptyMessage="Waiting for the tasker to share location."
                />
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Assign a tasker to enable location tracking.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageThread taskId={task.id} initial={conversation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Proof photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TaskPhotoGallery photos={photos} />
              <PhotoUpload taskId={task.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Reference attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttachmentList attachments={attachments} />
              <AttachmentUpload taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <ReassignForm taskId={task.id} currentTaskerId={task.taskerId} taskers={taskers} />
              {task.taskerId ? (
                <Link
                  href={`/taskers/${task.taskerId}`}
                  className="mt-2 inline-block text-xs font-semibold text-primary hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
                >
                  View {task.taskerName ?? "tasker"} profile
                </Link>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Reassigning resets the task to Assigned and notifies the new tasker.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" aria-hidden />
                Activity timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTimeline items={events} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
