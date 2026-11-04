import "server-only";
import { alias } from "drizzle-orm/sqlite-core";
import { and, asc, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  auditLogs,
  grievanceAttachments,
  grievanceComments,
  grievances,
  tasks,
  users,
} from "@/lib/db/schema";
import type { GrievanceFilters } from "./schemas";

const taskerUser = alias(users, "grievance_tasker");
const assigneeUser = alias(users, "grievance_assignee");
const authorUser = alias(users, "grievance_author");

export type GrievanceRow = Awaited<ReturnType<typeof listGrievances>>[number];

export async function listGrievances(
  db: Db,
  orgId: string,
  filters: GrievanceFilters,
  options: { taskerId?: string } = {},
) {
  const conditions = [eq(grievances.orgId, orgId)];
  if (options.taskerId) conditions.push(eq(grievances.taskerId, options.taskerId));
  if (filters.status === "open_queue") {
    conditions.push(inArray(grievances.status, ["open", "under_review"]));
  } else if (filters.status && filters.status !== "all") {
    conditions.push(eq(grievances.status, filters.status));
  }
  if (filters.severity) conditions.push(eq(grievances.severity, filters.severity));
  if (filters.category) conditions.push(eq(grievances.category, filters.category));
  if (filters.taskerId) conditions.push(eq(grievances.taskerId, filters.taskerId));
  if (filters.q) {
    const pattern = `%${filters.q.replaceAll("%", "").replaceAll("_", "")}%`;
    conditions.push(
      or(like(grievances.description, pattern), like(tasks.title, pattern)) as never,
    );
  }

  return db
    .select({
      grievance: grievances,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskerName: taskerUser.name,
      taskerEmail: taskerUser.email,
      assigneeName: assigneeUser.name,
      commentCount: sql<number>`(
        SELECT count(*) FROM grievance_comments gc WHERE gc.grievance_id = ${grievances.id}
      )`,
    })
    .from(grievances)
    .leftJoin(tasks, eq(tasks.id, grievances.taskId))
    .leftJoin(taskerUser, eq(taskerUser.id, grievances.taskerId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, grievances.assigneeId))
    .where(and(...conditions))
    .orderBy(desc(grievances.createdAt))
    .limit(100);
}

export async function getGrievanceById(db: Db, orgId: string, id: string) {
  return (
    (await db
      .select({
        grievance: grievances,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        taskerName: taskerUser.name,
        taskerEmail: taskerUser.email,
        taskerPhone: taskerUser.phone,
        assigneeName: assigneeUser.name,
      })
      .from(grievances)
      .leftJoin(tasks, eq(tasks.id, grievances.taskId))
      .leftJoin(taskerUser, eq(taskerUser.id, grievances.taskerId))
      .leftJoin(assigneeUser, eq(assigneeUser.id, grievances.assigneeId))
      .where(and(eq(grievances.id, id), eq(grievances.orgId, orgId)))
      .get()) ?? null
  );
}

export async function listGrievanceComments(
  db: Db,
  grievanceId: string,
  includeInternal: boolean,
) {
  return db
    .select({
      comment: grievanceComments,
      authorName: authorUser.name,
      authorRole: authorUser.role,
    })
    .from(grievanceComments)
    .leftJoin(authorUser, eq(authorUser.id, grievanceComments.authorId))
    .where(
      includeInternal
        ? eq(grievanceComments.grievanceId, grievanceId)
        : and(
            eq(grievanceComments.grievanceId, grievanceId),
            eq(grievanceComments.isInternal, false),
          ),
    )
    .orderBy(asc(grievanceComments.createdAt));
}

export async function listGrievanceAttachments(db: Db, grievanceId: string) {
  return db
    .select()
    .from(grievanceAttachments)
    .where(eq(grievanceAttachments.grievanceId, grievanceId))
    .orderBy(asc(grievanceAttachments.createdAt));
}

export async function listGrievanceAudit(db: Db, orgId: string, grievanceId: string) {
  return db
    .select({ log: auditLogs, actorName: authorUser.name })
    .from(auditLogs)
    .leftJoin(authorUser, eq(authorUser.id, auditLogs.actorId))
    .where(
      and(
        eq(auditLogs.orgId, orgId),
        eq(auditLogs.entity, "grievance"),
        eq(auditLogs.entityId, grievanceId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
}

export async function listTaskerTasksForGrievance(db: Db, orgId: string, taskerId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      scheduledStart: tasks.scheduledStart,
    })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.taskerId, taskerId)))
    .orderBy(desc(tasks.scheduledStart))
    .limit(60);
}

export async function listDispatcherOptions(db: Db, orgId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        inArray(users.role, ["dispatcher", "admin"]),
        eq(users.status, "active"),
      ),
    )
    .orderBy(asc(users.name));
}

export async function listTaskerOptionsForGrievanceFilter(db: Db, orgId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, "tasker")))
    .orderBy(asc(users.name));
}

export async function countOpenGrievances(db: Db, orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(grievances)
    .where(and(eq(grievances.orgId, orgId), inArray(grievances.status, ["open", "under_review"])));
  return Number(row?.n ?? 0);
}
