import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { isDispatcherRole } from "@/lib/permissions";
import {
  getGrievanceById,
  listGrievanceAttachments,
  listGrievanceComments,
} from "@/features/grievances/queries";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession(request);
    const { id } = await params;
    const db = getDb();
    const grievance = await getGrievanceById(db, session.orgId, id);
    if (!grievance) throw new NotFoundError("Grievance not found");
    const dispatcher = isDispatcherRole(session.user.role);
    if (!dispatcher && grievance.grievance.taskerId !== session.user.id) {
      throw new ForbiddenError("You cannot access this grievance");
    }

    const [comments, attachments] = await Promise.all([
      listGrievanceComments(db, id, dispatcher),
      listGrievanceAttachments(db, id),
    ]);

    return json({
      grievance: grievance.grievance,
      taskTitle: grievance.taskTitle,
      taskerName: grievance.taskerName,
      comments: comments.map((row) => ({
        id: row.comment.id,
        body: row.comment.body,
        isInternal: row.comment.isInternal,
        authorName: row.authorName,
        createdAt: row.comment.createdAt.toISOString(),
      })),
      attachments: attachments.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        size: row.size,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
