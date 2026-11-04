import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GrievanceStatusBadge, SeverityBadge } from "@/components/status-badges";
import { GrievanceAttachments } from "@/features/grievances/components/grievance-attachments";
import { GrievanceComments } from "@/features/grievances/components/grievance-comments";
import { GrievanceCommentForm } from "@/features/grievances/components/grievance-comment-form";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import {
  getGrievanceById,
  listGrievanceAttachments,
  listGrievanceComments,
} from "@/features/grievances/queries";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Grievance" };
export const dynamic = "force-dynamic";

export default async function MyGrievanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireTasker();
  const { id } = await params;
  const db = getDb();
  const grievance = await getGrievanceById(db, user.orgId, id);
  if (!grievance || grievance.grievance.taskerId !== user.id) notFound();

  const [comments, attachments] = await Promise.all([
    listGrievanceComments(db, id, false),
    listGrievanceAttachments(db, id),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/my-grievances" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        My grievances
      </Link>
      <PageHeader
        eyebrow="Grievance"
        title={grievance.taskTitle ?? "Task grievance"}
        description={`Filed ${formatDateTime(grievance.grievance.createdAt)}`}
        actions={
          <Link
            href={`/my-tasks/${grievance.grievance.taskId}`}
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Your report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{grievance.grievance.description}</p>
          <GrievanceAttachments attachments={attachments} />
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
          <CardTitle>Conversation with dispatch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <GrievanceComments comments={comments} />
          <div className="border-t border-border pt-3">
            <GrievanceCommentForm grievanceId={id} allowInternal={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
