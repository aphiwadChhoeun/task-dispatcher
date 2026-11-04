import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { canReadTaskMessages, canViewTask } from "@/lib/permissions";
import { ensureTaskThread, getTaskById, markThreadRead } from "@/features/tasks/queries";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession(request);
    const { id } = await params;
    const db = getDb();
    const task = await getTaskById(db, session.orgId, id);
    if (!task) throw new NotFoundError("Task not found");
    if (!canViewTask(session.user, task) || !canReadTaskMessages(session.user, task)) {
      throw new ForbiddenError("You cannot read messages on this task");
    }
    const threadId = await ensureTaskThread(db, session.orgId, id);
    await markThreadRead(db, session.orgId, threadId, session.user.id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
