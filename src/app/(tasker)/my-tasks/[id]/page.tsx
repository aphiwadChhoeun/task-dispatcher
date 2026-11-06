import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  MapPin,
  MessageSquare,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PriorityBadge, StatusBadge } from "@/components/status-badges";
import { TaskStatusActions } from "@/features/tasks/components/task-status-actions";
import { TaskTimeline } from "@/features/tasks/components/task-timeline";
import { TaskPhotoGallery } from "@/features/tasks/components/photo-gallery";
import { PhotoUpload } from "@/features/tasks/components/photo-upload";
import { MessageThread } from "@/features/messaging/components/message-thread";
import { DirectionsMap } from "@/features/maps/components/directions-map";
import { LocationSharer } from "@/features/location/components/location-sharer";
import { getTaskConversation } from "@/features/messaging/service";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { getTaskById, listTaskEvents, listTaskPhotos } from "@/features/tasks/queries";
import { getTransitionOptions, showsLocation } from "@/features/tasks/state-machine";
import { formatAddress, formatDateTime, formatWindow, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Task" };
export const dynamic = "force-dynamic";

export default async function TaskerTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireTasker();
  const { id } = await params;
  const db = getDb();
  const task = await getTaskById(db, user.orgId, id);
  if (!task || task.taskerId !== user.id) notFound();

  const [events, photos, conversation] = await Promise.all([
    listTaskEvents(db, user.orgId, task.id),
    listTaskPhotos(db, user.orgId, task.id),
    getTaskConversation(user, task.id),
  ]);

  const transitions = getTransitionOptions(
    task.status,
    { role: user.role, isAssignedTasker: true },
    task.resumeStatus,
  );

  const active = ["assigned", "accepted", "en_route", "in_progress", "on_hold"].includes(task.status);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={titleCase(task.type)}
        title={task.title}
        description={formatWindow(task.scheduledStart, task.scheduledEnd)}
        actions={
          <Link href="/my-tasks" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            All tasks
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <span className="text-xs text-muted-foreground">Assigned {formatDateTime(task.createdAt)}</span>
      </div>

      {active ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Next step</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusActions taskId={task.id} taskTitle={task.title} transitions={transitions} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            This task is {task.status}. You can still add proof photos or message dispatch.
          </CardContent>
        </Card>
      )}

      {showsLocation(task.status) ? <LocationSharer taskId={task.id} /> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-4" aria-hidden />
            Address & directions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p className="font-medium">{formatAddress(task) || "No address provided"}</p>
            {task.customerName || task.customerPhone ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <UserRound className="size-4" aria-hidden />
                {task.customerName ?? "Customer"}
                {task.customerPhone ? (
                  <a
                    className="inline-flex min-h-11 items-center gap-1 font-medium text-primary"
                    href={`tel:${task.customerPhone}`}
                  >
                    <Phone className="size-3.5" aria-hidden />
                    Call
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
          <DirectionsMap
            lat={task.lat}
            lng={task.lng}
            title={task.title}
            address={{
              addressStreet: task.addressStreet,
              addressCity: task.addressCity,
              addressState: task.addressState,
              addressPostalCode: task.addressPostalCode,
              addressCountry: task.addressCountry,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Task details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {task.description ? (
            <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>
          ) : null}
          <p className="flex items-center gap-1.5">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
            {formatWindow(task.scheduledStart, task.scheduledEnd)}
          </p>
          {task.instructions ? (
            <div>
              <SectionHeading title="Instructions" className="mb-1" />
              <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3">{task.instructions}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/my-tasks/${task.id}/grievance`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ShieldAlert className="size-4" aria-hidden />
              File a grievance
            </Link>
            <Link href="/my-grievances" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              My grievances
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
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
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MessageThread taskId={task.id} initial={conversation} />
        </CardContent>
      </Card>

      <details className="rounded-2xl border border-border/85 bg-card p-4 shadow-card">
        <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">Status history</summary>
        <div className="mt-3">
          <TaskTimeline items={events} />
        </div>
      </details>
    </div>
  );
}
