import { apiError, json, parseJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertCan, canViewTask } from "@/lib/permissions";
import { requireApiSession } from "@/features/auth/session";
import { assertApiMutation } from "@/lib/csrf";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getTaskById } from "@/features/tasks/queries";
import { updateTask, deleteTask } from "@/features/tasks/service";
import { taskFormSchema } from "@/features/tasks/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession(request);
    const { id } = await params;
    const task = await getTaskById(getDb(), session.orgId, id);
    if (!task) throw new NotFoundError("Task not found");
    if (!canViewTask(session.user, task)) throw new ForbiddenError("You cannot access this task");
    return json({ task });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    assertCan(session.user.role, "tasks.update");
    const { id } = await params;
    const values = await parseJson(request, taskFormSchema);
    const task = await updateTask(session.user, id, values);
    return json({ task });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    assertCan(session.user.role, "tasks.delete");
    const { id } = await params;
    await deleteTask(session.user, id);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
