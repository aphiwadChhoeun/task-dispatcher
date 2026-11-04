import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { grievances } from "@/lib/db/schema";
import { getStorage } from "@/features/files/storage";
import { canViewTask, isDispatcherRole } from "@/lib/permissions";
import { getTaskById } from "@/features/tasks/queries";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const session = await requireApiSession(request);
    const { key: segments } = await params;
    const key = segments.map((segment) => decodeURIComponent(segment)).join("/");
    const [orgId, scope, entityId] = key.split("/");
    if (!orgId || !scope || !entityId) throw new NotFoundError("File not found");
    if (orgId !== session.orgId) throw new ForbiddenError("You cannot access this file");

    const db = getDb();
    if (scope === "tasks") {
      const task = await getTaskById(db, session.orgId, entityId);
      if (!task) throw new NotFoundError("Task not found");
      if (!canViewTask(session.user, task)) throw new ForbiddenError("You cannot access this file");
    } else if (scope === "grievances") {
      const grievance = await db
        .select()
        .from(grievances)
        .where(and(eq(grievances.id, entityId), eq(grievances.orgId, session.orgId)))
        .get();
      if (!grievance) throw new NotFoundError("Grievance not found");
      if (!isDispatcherRole(session.user.role) && grievance.taskerId !== session.user.id) {
        throw new ForbiddenError("You cannot access this file");
      }
    } else {
      throw new NotFoundError("File not found");
    }

    const file = await getStorage().get(key);
    if (!file) throw new NotFoundError("File not found");

    return new Response(file.body, {
      headers: {
        "content-type": file.contentType,
        "content-length": String(file.size),
        "cache-control": "private, max-age=3600",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
