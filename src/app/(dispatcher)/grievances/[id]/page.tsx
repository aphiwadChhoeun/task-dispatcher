import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GrievanceStatusBadge, SeverityBadge } from "@/components/status-badges";
import { GrievanceAttachments } from "@/features/grievances/components/grievance-attachments";
import { GrievanceComments } from "@/features/grievances/components/grievance-comments";
import { GrievanceCommentForm } from "@/features/grievances/components/grievance-comment-form";
import { GrievanceUpdateForm } from "@/features/grievances/components/grievance-update-form";
import { GrievanceAudit } from "@/features/grievances/components/grievance-audit";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import {
  getGrievanceById,
  listDispatcherOptions,
  listGrievanceAttachments,
  listGrievanceAudit,
  listGrievanceComments,
} from "@/features/grievances/queries";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Grievance" };
export const dynamic = "force-dynamic";

export default async function GrievanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireDispatcher();
  const { id } = await params;
  const db = getDb();
  const grievance = await getGrievanceById(db, user.orgId, id);
  if (!grievance) notFound();

  const [comments, attachments, dispatchers, audit] = await Promise.all([
    listGrievanceComments(db, id, true),
    listGrievanceAttachments(db, id),
    listDispatcherOptions(db, user.orgId),
    listGrievanceAudit(db, user.orgId, id),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/grievances" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Grievance queue
      </Link>
      <PageHeader
        eyebrow="Grievance"
        title={grievance.taskTitle ?? "Task grievance"}
        description={`Filed ${formatDateTime(grievance.grievance.createdAt)} by ${grievance.taskerName ?? "a tasker"}`}
        actions={
          <Link
            href={`/tasks/${grievance.grievance.taskId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View task
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <GrievanceStatusBadge status={grievance.grievance.status} />
        <SeverityBadge severity={grievance.grievance.severity} />
        <Badge variant="outline">{titleCase(grievance.grievance.category)}</Badge>
        {grievance.assigneeName ? <Badge variant="secondary">Assigned to {grievance.assigneeName}</Badge> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm">{grievance.grievance.description}</p>
              <GrievanceAttachments attachments={attachments} />
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{grievance.taskerName}</span>
                <span>{grievance.taskerEmail}</span>
                {grievance.taskerPhone ? (
                  <a className="inline-flex items-center gap-1 text-primary" href={`tel:${grievance.taskerPhone}`}>
                    <Phone className="size-3.5" aria-hidden />
                    Call
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {grievance.grievance.resolutionNotes ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{grievance.grievance.resolutionNotes}</p>
                {grievance.grievance.resolvedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Closed {formatDateTime(grievance.grievance.resolvedAt)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <GrievanceComments comments={comments} />
              <div className="border-t border-border pt-3">
                <GrievanceCommentForm grievanceId={id} allowInternal />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Manage</CardTitle>
            </CardHeader>
            <CardContent>
              <GrievanceUpdateForm
                grievanceId={id}
                status={grievance.grievance.status}
                assigneeId={grievance.grievance.assigneeId}
                resolutionNotes={grievance.grievance.resolutionNotes}
                dispatchers={dispatchers}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <GrievanceAudit rows={audit} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
