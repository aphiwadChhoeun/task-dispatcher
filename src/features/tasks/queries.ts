import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "@/lib/db";
import {
  grievances,
  locations,
  messageThreads,
  messages,
  taskAttachments,
  taskerPresence,
  taskers,
  taskEvents,
  taskPhotos,
  tasks,
  threadReads,
  users,
  type Task,
  type TaskStatus,
} from "@/lib/db/schema";
import { config } from "@/config";import { ACTIVE_STATUSES, showsLocation } from "./state-machine";
import type { TaskFilters } from "./schemas";
import type { TaskerFilters } from "@/features/taskers/schemas";

const taskerUser = alias(users, "tasker_user");
const actorUser = alias(users, "actor_user");
const senderUser = alias(users, "sender_user");

export type TaskWithTasker = Task & {
  taskerName: string | null;
  taskerEmail: string | null;
  taskerPhone: string | null;
  taskerColor: string | null;
};

export async function listTasks(
  db: Db,
  orgId: string,
  filters: TaskFilters,
  limit = 200,
): Promise<TaskWithTasker[]> {
  const conditions = [eq(tasks.orgId, orgId)];

  if (filters.status === "active") {
    conditions.push(inArray(tasks.status, [...ACTIVE_STATUSES]));
  } else if (filters.status && filters.status !== "all") {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters.taskerId) conditions.push(eq(tasks.taskerId, filters.taskerId));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    conditions.push(
      and(gte(tasks.scheduledStart, start), lte(tasks.scheduledStart, end)) as never,
    );
  }
  if (filters.q) {
    const pattern = `%${filters.q.replaceAll("%", "").replaceAll("_", "")}%`;
    conditions.push(
      or(
        like(tasks.title, pattern),
        like(tasks.description, pattern),
        like(tasks.addressStreet, pattern),
        like(tasks.addressCity, pattern),
        like(tasks.customerName, pattern),
      ) as never,
    );
  }

  const rows = await db
    .select({
      task: tasks,
      taskerName: taskerUser.name,
      taskerEmail: taskerUser.email,
      taskerPhone: taskerUser.phone,
      taskerColor: taskers.color,
    })
    .from(tasks)
    .leftJoin(taskerUser, eq(tasks.taskerId, taskerUser.id))
    .leftJoin(taskers, eq(taskers.userId, taskerUser.id))
    .where(and(...conditions))
    .orderBy(asc(tasks.scheduledStart), desc(tasks.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.task,
    taskerName: row.taskerName,
    taskerEmail: row.taskerEmail,
    taskerPhone: row.taskerPhone,
    taskerColor: row.taskerColor,
  }));
}

export async function getTaskById(
  db: Db,
  orgId: string,
  id: string,
): Promise<TaskWithTasker | null> {
  const row = await db
    .select({
      task: tasks,
      taskerName: taskerUser.name,
      taskerEmail: taskerUser.email,
      taskerPhone: taskerUser.phone,
      taskerColor: taskers.color,
    })
    .from(tasks)
    .leftJoin(taskerUser, eq(tasks.taskerId, taskerUser.id))
    .leftJoin(taskers, eq(taskers.userId, taskerUser.id))
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .get();

  if (!row) return null;
  return {
    ...row.task,
    taskerName: row.taskerName,
    taskerEmail: row.taskerEmail,
    taskerPhone: row.taskerPhone,
    taskerColor: row.taskerColor,
  };
}

export async function listTaskEvents(db: Db, orgId: string, taskId: string) {
  return db
    .select({
      event: taskEvents,
      actorName: actorUser.name,
      actorRole: actorUser.role,
    })
    .from(taskEvents)
    .leftJoin(actorUser, eq(taskEvents.actorId, actorUser.id))
    .where(and(eq(taskEvents.orgId, orgId), eq(taskEvents.taskId, taskId)))
    .orderBy(desc(taskEvents.createdAt))
    .limit(100);
}

export async function listTaskPhotos(db: Db, orgId: string, taskId: string) {
  return db
    .select({
      photo: taskPhotos,
      uploaderName: actorUser.name,
    })
    .from(taskPhotos)
    .leftJoin(actorUser, eq(taskPhotos.uploadedBy, actorUser.id))
    .where(and(eq(taskPhotos.orgId, orgId), eq(taskPhotos.taskId, taskId)))
    .orderBy(asc(taskPhotos.createdAt));
}

export async function listTaskAttachments(db: Db, orgId: string, taskId: string) {
  return db
    .select()
    .from(taskAttachments)
    .where(and(eq(taskAttachments.orgId, orgId), eq(taskAttachments.taskId, taskId)))
    .orderBy(desc(taskAttachments.createdAt));
}

export async function listTaskerOptions(db: Db, orgId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      color: taskers.color,
      skills: taskers.skills,
    })
    .from(users)
    .leftJoin(taskers, eq(taskers.userId, users.id))
    .where(and(eq(users.orgId, orgId), eq(users.role, "tasker")))
    .orderBy(asc(users.name));
}

export async function listTaskers(
  db: Db,
  orgId: string,
  filters: TaskerFilters = {},
) {
  const conditions = [eq(users.orgId, orgId), eq(users.role, "tasker")];

  if (filters.status) conditions.push(eq(users.status, filters.status));
  if (filters.q) {
    const pattern = `%${filters.q.replaceAll("%", "").replaceAll("_", "")}%`;
    conditions.push(
      or(
        like(users.name, pattern),
        like(users.email, pattern),
        like(users.phone, pattern),
        like(taskers.skills, pattern),
        like(taskers.vehicle, pattern),
        like(taskers.availability, pattern),
      ) as never,
    );
  }

  const people = await db
    .select({
      user: users,
      tasker: taskers,
    })
    .from(users)
    .leftJoin(taskers, eq(taskers.userId, users.id))
    .where(and(...conditions))
    .orderBy(asc(users.name));

  const counts = await db
    .select({ taskerId: tasks.taskerId, n: count() })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), inArray(tasks.status, [...ACTIVE_STATUSES])))
    .groupBy(tasks.taskerId);

  const countMap = new Map(counts.map((row) => [row.taskerId, Number(row.n)]));

  return people.map((row) => ({
    ...row.user,
    color: row.tasker?.color ?? "#0f766e",
    skills: row.tasker?.skills ?? null,
    vehicle: row.tasker?.vehicle ?? null,
    availability: row.tasker?.availability ?? null,
    activeTasks: countMap.get(row.user.id) ?? 0,
  }));
}

export async function getTaskerProfile(db: Db, orgId: string, userId: string) {
  const row = await db
    .select({ user: users, tasker: taskers })
    .from(users)
    .leftJoin(taskers, eq(taskers.userId, users.id))
    .where(and(eq(users.orgId, orgId), eq(users.id, userId), eq(users.role, "tasker")))
    .get();
  if (!row) return null;
  return {
    ...row.user,
    color: row.tasker?.color ?? "#0f766e",
    skills: row.tasker?.skills ?? null,
    vehicle: row.tasker?.vehicle ?? null,
    availability: row.tasker?.availability ?? null,
  };
}

export async function ensureTaskThread(
  db: Db,
  orgId: string,
  taskId: string,
): Promise<string> {
  const existing = await db
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .where(eq(messageThreads.taskId, taskId))
    .get();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  try {
    await db.insert(messageThreads).values({ id, orgId, taskId });
    return id;
  } catch {
    const again = await db
      .select({ id: messageThreads.id })
      .from(messageThreads)
      .where(eq(messageThreads.taskId, taskId))
      .get();
    if (again) return again.id;
    throw new Error("Could not create a message thread");
  }
}

export type ThreadMessage = {
  id: string;
  body: string;
  attachments: string | null;
  createdAt: Date;
  senderId: string;
  senderName: string;
  senderRole: string;
};

export async function listThreadMessages(
  db: Db,
  orgId: string,
  threadId: string,
  limit = 100,
): Promise<ThreadMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      attachments: messages.attachments,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderName: senderUser.name,
      senderRole: senderUser.role,
    })
    .from(messages)
    .leftJoin(senderUser, eq(messages.senderId, senderUser.id))
    .where(and(eq(messages.orgId, orgId), eq(messages.threadId, threadId)))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    senderName: row.senderName ?? "Unknown",
    senderRole: row.senderRole ?? "tasker",
  }));
}

export async function markThreadRead(
  db: Db,
  orgId: string,
  threadId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(threadReads)
    .values({ orgId, threadId, userId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [threadReads.threadId, threadReads.userId],
      set: { lastReadAt: now },
    });
}

export async function getThreadReads(db: Db, orgId: string, threadId: string) {
  return db
    .select()
    .from(threadReads)
    .where(and(eq(threadReads.orgId, orgId), eq(threadReads.threadId, threadId)));
}

export async function unreadCountsForUser(
  db: Db,
  orgId: string,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ taskId: messageThreads.taskId, n: count(messages.id) })
    .from(messageThreads)
    .innerJoin(messages, eq(messages.threadId, messageThreads.id))
    .leftJoin(
      threadReads,
      and(
        eq(threadReads.threadId, messageThreads.id),
        eq(threadReads.userId, userId),
        eq(threadReads.orgId, orgId),
      ),
    )
    .where(
      and(
        eq(messageThreads.orgId, orgId),
        ne(messages.senderId, userId),
        or(
          isNull(threadReads.lastReadAt),
          gt(messages.createdAt, threadReads.lastReadAt),
        ) as never,
      ),
    )
    .groupBy(messageThreads.taskId);

  return new Map(rows.map((row) => [row.taskId, Number(row.n)]));
}

export async function listActiveTasksForMap(db: Db, orgId: string) {
  return db
    .select({
      task: tasks,
      taskerName: taskerUser.name,
      taskerColor: taskers.color,
    })
    .from(tasks)
    .leftJoin(taskerUser, eq(tasks.taskerId, taskerUser.id))
    .leftJoin(taskers, eq(taskers.userId, taskerUser.id))
    .where(and(eq(tasks.orgId, orgId), inArray(tasks.status, [...ACTIVE_STATUSES])))
    .orderBy(asc(tasks.scheduledStart));
}

export type PresenceItem = {
  taskerId: string;
  taskerName: string;
  taskerPhone: string | null;
  color: string;
  taskId: string | null;
  taskTitle: string | null;
  taskStatus: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updatedAt: number;
  stale: boolean;
};

export async function listPresence(db: Db, orgId: string): Promise<PresenceItem[]> {
  const rows = await db
    .select({
      presence: taskerPresence,
      name: users.name,
      phone: users.phone,
      color: taskers.color,
      taskTitle: tasks.title,
    })
    .from(taskerPresence)
    .innerJoin(users, eq(taskerPresence.taskerId, users.id))
    .leftJoin(taskers, eq(taskers.userId, taskerPresence.taskerId))
    .leftJoin(tasks, eq(tasks.id, taskerPresence.taskId))
    .where(eq(taskerPresence.orgId, orgId))
    .orderBy(desc(taskerPresence.updatedAt));

  const now = Date.now();
  return rows.map((row) => ({
    taskerId: row.presence.taskerId,
    taskerName: row.name,
    taskerPhone: row.phone,
    color: row.color ?? "#0f766e",
    taskId: row.presence.taskId,
    taskTitle: row.taskTitle,
    taskStatus: row.presence.taskStatus,
    lat: row.presence.lat,
    lng: row.presence.lng,
    accuracy: row.presence.accuracy,
    heading: row.presence.heading,
    speed: row.presence.speed,
    updatedAt: row.presence.updatedAt.getTime(),
    stale: now - row.presence.updatedAt.getTime() > config.location.staleSeconds * 1000,
  }));
}

export async function getPresenceForTasker(
  db: Db,
  orgId: string,
  taskerId: string,
): Promise<PresenceItem | null> {
  const row = await db
    .select({
      presence: taskerPresence,
      name: users.name,
      phone: users.phone,
      color: taskers.color,
      taskTitle: tasks.title,
    })
    .from(taskerPresence)
    .innerJoin(users, eq(taskerPresence.taskerId, users.id))
    .leftJoin(taskers, eq(taskers.userId, taskerPresence.taskerId))
    .leftJoin(tasks, eq(tasks.id, taskerPresence.taskId))
    .where(and(eq(taskerPresence.orgId, orgId), eq(taskerPresence.taskerId, taskerId)))
    .get();

  if (!row) return null;
  return {
    taskerId: row.presence.taskerId,
    taskerName: row.name,
    taskerPhone: row.phone,
    color: row.color ?? "#0f766e",
    taskId: row.presence.taskId,
    taskTitle: row.taskTitle,
    taskStatus: row.presence.taskStatus,
    lat: row.presence.lat,
    lng: row.presence.lng,
    accuracy: row.presence.accuracy,
    heading: row.presence.heading,
    speed: row.presence.speed,
    updatedAt: row.presence.updatedAt.getTime(),
    stale: Date.now() - row.presence.updatedAt.getTime() > config.location.staleSeconds * 1000,
  };
}

export async function getDashboardStats(db: Db, orgId: string) {
  const statusRows = await db
    .select({ status: tasks.status, n: count() })
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .groupBy(tasks.status);

  const byStatus = Object.fromEntries(
    statusRows.map((row) => [row.status, Number(row.n)]),
  ) as Partial<Record<TaskStatus, number>>;

  const [taskerRow] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, "tasker"), eq(users.status, "active")));

  const [openGrievances] = await db
    .select({ n: count() })
    .from(grievances)
    .where(and(eq(grievances.orgId, orgId), inArray(grievances.status, ["open", "under_review"])));

  const [activeTaskers] = await db
    .select({ n: sql<number>`count(distinct ${taskerPresence.taskerId})` })
    .from(taskerPresence)
    .where(
      and(
        eq(taskerPresence.orgId, orgId),
        gt(
          taskerPresence.updatedAt,
          new Date(Date.now() - config.location.staleSeconds * 1000),
        ),
      ),
    );

  return {
    byStatus,
    total: statusRows.reduce((sum, row) => sum + Number(row.n), 0),
    activeTaskers: Number(taskerRow?.n ?? 0),
    sharingNow: Number(activeTaskers?.n ?? 0),
    openGrievances: Number(openGrievances?.n ?? 0),
  };
}

export async function taskLocationHistory(
  db: Db,
  orgId: string,
  taskId: string,
  limit = 200,
) {
  return db
    .select()
    .from(locations)
    .where(and(eq(locations.orgId, orgId), eq(locations.taskId, taskId)))
    .orderBy(desc(locations.recordedAt))
    .limit(limit);
}

export async function taskHasLocationSharing(task: Task): Promise<boolean> {
  return showsLocation(task.status);
}

export { taskerUser, actorUser };
