import { assertApiMutation } from "@/lib/csrf";
import {
  apiError,
  assertFound,
  json,
  parseJson,
  requireApiPermission,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireApiSession } from "@/features/auth/session";
import { isDispatcherRole } from "@/lib/permissions";
import { listTasks, getTaskById, listTaskerOptions } from "@/features/tasks/queries";
import { createTask } from "@/features/tasks/service";
import { taskFiltersSchema, taskFormSchema } from "@/features/tasks/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const filters = taskFiltersSchema.parse(raw);
    const db = getDb();
    const scoped = isDispatcherRole(session.user.role)
      ? filters
      : { ...filters, taskerId: session.user.id };
    const items = await listTasks(db, session.orgId, scoped);
    return json({
      items: items.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        type: task.type,
        taskerId: task.taskerId,
        taskerName: task.taskerName,
        scheduledStart: task.scheduledStart?.toISOString() ?? null,
        scheduledEnd: task.scheduledEnd?.toISOString() ?? null,
        address: {
          street: task.addressStreet,
          city: task.addressCity,
          state: task.addressState,
          postalCode: task.addressPostalCode,
          country: task.addressCountry,
        },
        lat: task.lat,
        lng: task.lng,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    requireApiPermission(session, "tasks.create");
    const values = await parseJson(request, taskFormSchema);
    const db = getDb();
    const taskers = await listTaskerOptions(db, session.orgId);
    assertFound(
      taskers.find((tasker) => tasker.id === values.taskerId && tasker.status === "active"),
      "Tasker not found",
    );
    const id = await createTask(session.user, values);
    const task = assertFound(await getTaskById(db, session.orgId, id));
    return json({ task }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
