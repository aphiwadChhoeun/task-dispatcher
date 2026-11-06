import { and, eq, inArray } from "drizzle-orm";
import { assertApiMutation } from "@/lib/csrf";
import { apiError, assertFound, json, parseJson, requireApiPermission } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { grievances, memberships, tasks, users } from "@/lib/db/schema";
import { isDispatcherRole } from "@/lib/permissions";
import { recordAudit } from "@/features/audit/log";
import { publish } from "@/features/events";
import { listGrievances } from "@/features/grievances/queries";
import {
  grievanceCreateSchema,
  grievanceFiltersSchema,
} from "@/features/grievances/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const url = new URL(request.url);
    const parsed = grievanceFiltersSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    const filters = parsed.success ? parsed.data : {};
    const rows = await listGrievances(
      getDb(),
      session.orgId,
      filters,
      isDispatcherRole(session.user.role) ? {} : { taskerId: session.user.id },
    );
    return json({
      items: rows.map((row) => ({
        id: row.grievance.id,
        taskId: row.grievance.taskId,
        taskTitle: row.taskTitle,
        category: row.grievance.category,
        severity: row.grievance.severity,
        status: row.grievance.status,
        description: row.grievance.description,
        createdAt: row.grievance.createdAt.toISOString(),
        resolvedAt: row.grievance.resolvedAt?.toISOString() ?? null,
        taskerName: row.taskerName,
        commentCount: Number(row.commentCount),
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
    requireApiPermission(session, "grievances.create");
    if (session.user.role !== "tasker") {
      return json({ error: "Only taskers can file a grievance" }, { status: 403 });
    }
    const body = await parseJson(request, grievanceCreateSchema);
    const db = getDb();
    const task = assertFound(
      await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, body.taskId),
            eq(tasks.orgId, session.orgId),
            eq(tasks.taskerId, session.user.id),
          ),
        )
        .get(),
      "Task not found",
    );

    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(grievances).values({
      id,
      orgId: session.orgId,
      taskId: task.id,
      taskerId: session.user.id,
      category: body.category,
      severity: body.severity,
      description: body.description,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "grievance.opened",
      entity: "grievance",
      entityId: id,
      metadata: { taskId: task.id, category: body.category, severity: body.severity },
    });

    const dispatchers = await db
      .select({ id: users.id })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.orgId, session.orgId),
          inArray(memberships.role, ["dispatcher", "admin"]),
          eq(memberships.status, "active"),
        ),
      );

    await publish({
      type: "grievance.opened",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        grievanceId: id,
        taskId: task.id,
        taskTitle: task.title,
        category: body.category,
        severity: body.severity,
        taskerName: session.user.name,
      },
      audience: { roles: ["admin", "dispatcher"], userIds: [session.user.id] },
      notification: {
        userIds: dispatchers.map((row) => row.id),
        title: "New grievance filed",
        body: `${session.user.name}: ${body.description.slice(0, 120)}`,
        link: `/grievances/${id}`,
        kind: "grievance.opened",
      },
    });

    return json({ id, status: "open" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
