import { assertApiMutation } from "@/lib/csrf";
import { apiError, json, parseJson, requireApiPermission } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { changeTaskStatus } from "@/features/tasks/service";
import { taskStatusTransitionSchema } from "@/features/tasks/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    requireApiPermission(
      session,
      session.user.role === "tasker" ? "tasks.status.update.own" : "tasks.status.update.any",
    );
    const { id } = await params;
    const body = await parseJson(request, taskStatusTransitionSchema.omit({ taskId: true }));
    const task = await changeTaskStatus({
      actor: session.user,
      taskId: id,
      to: body.to,
      note: body.note,
      lat: body.lat,
      lng: body.lng,
    });
    return json({
      task: {
        id: task.id,
        status: task.status,
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
