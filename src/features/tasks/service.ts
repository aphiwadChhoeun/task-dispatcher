import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db";
import {
  messageThreads,
  taskAttachments,
  taskerPresence,
  taskEvents,
  taskPhotos,
  tasks,
  users,
  type Task,
  type TaskStatus,
  type User,
} from "@/lib/db/schema";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/features/audit/log";
import { publish } from "@/features/events";
import { getStorage } from "@/features/files/storage";
import { canViewTask, isDispatcherRole, type Role } from "@/lib/permissions";
import { TASK_STATUS_LABELS, checkTransition } from "./state-machine";
import type { TaskFormValues } from "./schemas";
import { ensureTaskThread, getTaskById } from "./queries";

type Actor = Pick<User, "id" | "orgId" | "role" | "name">;

function taskLink(actor: Actor, taskId: string): string {
  return isDispatcherRole(actor.role) ? `/tasks/${taskId}` : `/my-tasks/${taskId}`;
}

async function activeTasker(db: Db, orgId: string, taskerId: string) {
  return db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, taskerId),
        eq(users.orgId, orgId),
        eq(users.role, "tasker"),
        eq(users.status, "active"),
      ),
    )
    .get();
}

async function dispatcherIds(db: Db, orgId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        inArray(users.role, ["dispatcher", "admin"]),
        eq(users.status, "active"),
      ),
    );
  return rows.map((row) => row.id);
}

function eventAudience(taskerId: string | null) {
  return {
    roles: ["admin", "dispatcher"] as Role[],
    ...(taskerId ? { userIds: [taskerId] } : {}),
  };
}

export async function createTask(actor: Actor, values: TaskFormValues): Promise<string> {
  const db = getDb();
  const tasker = await activeTasker(db, actor.orgId, values.taskerId);
  if (!tasker) throw new AppError("Choose an active tasker from your organization", 422);

  const id = crypto.randomUUID();
  const now = new Date();
  const start = new Date(values.scheduledStart);
  const end = new Date(values.scheduledEnd);

  await db.batch([
    db.insert(tasks).values({
      id,
      orgId: actor.orgId,
      taskerId: tasker.id,
      createdBy: actor.id,
      title: values.title,
      description: values.description ?? null,
      type: values.type,
      priority: values.priority,
      status: "assigned",
      scheduledStart: start,
      scheduledEnd: end,
      addressStreet: values.addressStreet,
      addressCity: values.addressCity,
      addressState: values.addressState,
      addressPostalCode: values.addressPostalCode ?? null,
      addressCountry: values.addressCountry,
      lat: values.lat,
      lng: values.lng,
      customerName: values.customerName ?? null,
      customerPhone: values.customerPhone ?? null,
      notes: values.notes ?? null,
      instructions: values.instructions ?? null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(taskEvents).values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      taskId: id,
      actorId: actor.id,
      fromStatus: null,
      toStatus: "assigned",
      note: "Task created and assigned",
      createdAt: now,
    }),
    db.insert(messageThreads).values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      taskId: id,
      createdAt: now,
    }),
  ]);

  await publish({
    type: "task.assigned",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: {
      taskId: id,
      title: values.title,
      taskerId: tasker.id,
      taskerName: tasker.name,
      status: "assigned",
      priority: values.priority,
      scheduledStart: start.getTime(),
    },
    audience: eventAudience(tasker.id),
    notification: {
      userIds: [tasker.id],
      title: "New task assigned",
      body: values.title,
      link: `/my-tasks/${id}`,
      kind: "task.assigned",
    },
  });

  return id;
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  values: TaskFormValues,
): Promise<Task> {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");

  const taskerChanged = values.taskerId !== task.taskerId;
  if (taskerChanged) {
    if (!["assigned", "accepted", "on_hold"].includes(task.status)) {
      throw new ConflictError(
        "Reassigning is only allowed before the tasker starts travelling or working",
      );
    }
    const tasker = await activeTasker(db, actor.orgId, values.taskerId);
    if (!tasker) throw new AppError("Choose an active tasker from your organization", 422);
  }

  const now = new Date();
  const start = new Date(values.scheduledStart);
  const end = new Date(values.scheduledEnd);
  const nextStatus = taskerChanged ? "assigned" : task.status;

  await db.batch([
    db
      .update(tasks)
      .set({
        taskerId: values.taskerId,
        title: values.title,
        description: values.description ?? null,
        type: values.type,
        priority: values.priority,
        status: nextStatus,
        resumeStatus: taskerChanged ? null : task.resumeStatus,
        scheduledStart: start,
        scheduledEnd: end,
        addressStreet: values.addressStreet,
        addressCity: values.addressCity,
        addressState: values.addressState,
        addressPostalCode: values.addressPostalCode ?? null,
        addressCountry: values.addressCountry,
        lat: values.lat,
        lng: values.lng,
        customerName: values.customerName ?? null,
        customerPhone: values.customerPhone ?? null,
        notes: values.notes ?? null,
        instructions: values.instructions ?? null,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, actor.orgId))),
    db.insert(taskEvents).values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      taskId,
      actorId: actor.id,
      fromStatus: task.status,
      toStatus: nextStatus,
      note: taskerChanged
        ? `Task reassigned to ${values.taskerId === task.taskerId ? "the same tasker" : "a new tasker"}`
        : "Task details updated",
      createdAt: now,
    }),
  ]);

  await ensureTaskThread(db, actor.orgId, taskId);

  if (taskerChanged) {
    await recordAudit(db, {
      orgId: actor.orgId,
      actorId: actor.id,
      action: "task.reassigned",
      entity: "task",
      entityId: taskId,
      metadata: { fromTaskerId: task.taskerId, toTaskerId: values.taskerId },
    });

    await publish({
      type: "task.assigned",
      orgId: actor.orgId,
      actorId: actor.id,
      payload: {
        taskId,
        title: values.title,
        taskerId: values.taskerId,
        status: "assigned",
      },
      audience: eventAudience(values.taskerId),
      notification: {
        userIds: [values.taskerId],
        title: "Task assigned to you",
        body: values.title,
        link: `/my-tasks/${taskId}`,
        kind: "task.assigned",
      },
    });
  } else {
    await publish({
      type: "task.updated",
      orgId: actor.orgId,
      actorId: actor.id,
      payload: { taskId, title: values.title, status: nextStatus },
      audience: eventAudience(task.taskerId),
    });
  }

  const updated = await getTaskById(db, actor.orgId, taskId);
  if (!updated) throw new NotFoundError("Task not found");
  return updated;
}

export async function reassignTask(
  actor: Actor,
  taskId: string,
  taskerId: string,
  note?: string,
): Promise<void> {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");
  if (!["assigned", "accepted", "on_hold"].includes(task.status)) {
    throw new ConflictError("Only tasks that have not started can be reassigned");
  }
  const tasker = await activeTasker(db, actor.orgId, taskerId);
  if (!tasker) throw new AppError("Choose an active tasker", 422);

  const now = new Date();
  await db.batch([
    db
      .update(tasks)
      .set({ taskerId, status: "assigned", resumeStatus: null, updatedAt: now })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, actor.orgId))),
    db.insert(taskEvents).values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      taskId,
      actorId: actor.id,
      fromStatus: task.status,
      toStatus: "assigned",
      note: note?.trim() || "Task reassigned",
      createdAt: now,
    }),
  ]);

  await recordAudit(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    action: "task.reassigned",
    entity: "task",
    entityId: taskId,
    metadata: { fromTaskerId: task.taskerId, toTaskerId: taskerId },
  });

  await publish({
    type: "task.assigned",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: { taskId, title: task.title, taskerId, status: "assigned" },
    audience: eventAudience(taskerId),
    notification: {
      userIds: [taskerId],
      title: "Task assigned to you",
      body: task.title,
      link: `/my-tasks/${taskId}`,
      kind: "task.assigned",
    },
  });
}

export type TransitionInput = {
  actor: Actor;
  taskId: string;
  to: TaskStatus;
  note?: string;
  lat?: number;
  lng?: number;
};

export async function changeTaskStatus(input: TransitionInput): Promise<Task> {
  const db = getDb();
  const { actor, taskId } = input;
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");
  if (!canViewTask({ id: actor.id, role: actor.role, orgId: actor.orgId }, task)) {
    throw new ForbiddenError("You cannot update this task");
  }

  const isAssignedTasker = task.taskerId === actor.id;
  if (actor.role === "tasker" && !isAssignedTasker) {
    throw new ForbiddenError("You can only update tasks assigned to you");
  }

  // Taskers resuming from hold return to the status they paused at.
  let target = input.to;
  if (task.status === "on_hold" && actor.role === "tasker") {
    target = (task.resumeStatus as TaskStatus | null) ?? "accepted";
  }

  const check = checkTransition(task.status, target, {
    role: actor.role,
    isAssignedTasker,
  });
  if (!check.allowed) throw new ConflictError(check.reason);

  const note = input.note?.trim();
  if (check.requiresNote && (!note || note.length < 3)) {
    throw new AppError(
      target === "rejected"
        ? "Tell the dispatcher why you are rejecting this task"
        : "Add a reason for putting the task on hold",
      422,
    );
  }

  const now = new Date();
  const resumeStatus = target === "on_hold" ? task.status : null;

  // Accept/reject is only valid inside the assigned window.
  if (
    actor.role === "tasker" &&
    (target === "accepted" || target === "rejected") &&
    task.scheduledEnd &&
    now.getTime() > task.scheduledEnd.getTime()
  ) {
    throw new ConflictError(
      "The assigned window has closed. Ask dispatch to reschedule this task.",
    );
  }

  await db.batch([
    db
      .update(tasks)
      .set({ status: target, resumeStatus, updatedAt: now })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, actor.orgId))),
    db.insert(taskEvents).values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      taskId,
      actorId: actor.id,
      fromStatus: task.status,
      toStatus: target,
      note: note ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      createdAt: now,
    }),
  ]);

  // A terminal task must stop appearing on the live map, even if the tasker's
  // phone keeps a stale position around.
  if (["completed", "cancelled", "rejected"].includes(target) && task.taskerId) {
    await db
      .delete(taskerPresence)
      .where(and(eq(taskerPresence.taskerId, task.taskerId), eq(taskerPresence.taskId, taskId)));
  }

  const taskerRecipients = task.taskerId ? [task.taskerId] : [];
  const dispatchers = await dispatcherIds(db, actor.orgId);
  const recipients = isDispatcherRole(actor.role)
    ? taskerRecipients
    : [...dispatchers, actor.id];

  const noteSuffix = note ? `: ${note}` : "";
  await publish({
    type: "task.status_changed",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: {
      taskId,
      title: task.title,
      from: task.status,
      status: target,
      note: note ?? null,
      taskerId: task.taskerId,
      actorName: actor.name,
    },
    audience: eventAudience(task.taskerId),
    notification: {
      userIds: recipients.filter((id) => id !== actor.id),
      title: `Task ${TASK_STATUS_LABELS[target].toLowerCase()}`,
      body: `${task.title}${noteSuffix}`,
      link: taskLink(actor, taskId),
      kind: "task.status_changed",
    },
  });

  const updated = await getTaskById(db, actor.orgId, taskId);
  if (!updated) throw new NotFoundError("Task not found");
  return updated;
}

export async function cancelTask(actor: Actor, taskId: string, note?: string): Promise<Task> {
  return changeTaskStatus({
    actor,
    taskId,
    to: "cancelled",
    note: note?.trim() || "Cancelled by dispatcher",
  });
}

export async function deleteTask(actor: Actor, taskId: string): Promise<void> {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");

  const photos = await db
    .select({ key: taskPhotos.r2Key })
    .from(taskPhotos)
    .where(and(eq(taskPhotos.orgId, actor.orgId), eq(taskPhotos.taskId, taskId)));
  const attachments = await db
    .select({ key: taskAttachments.r2Key })
    .from(taskAttachments)
    .where(and(eq(taskAttachments.orgId, actor.orgId), eq(taskAttachments.taskId, taskId)));

  const storage = getStorage();
  await Promise.allSettled(
    [...photos, ...attachments].map((row) => storage.delete(row.key)),
  );

  await publish({
    type: "task.deleted",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: { taskId, title: task.title, taskerId: task.taskerId },
    audience: eventAudience(task.taskerId),
    notification: task.taskerId
      ? {
          userIds: [task.taskerId],
          title: "Task cancelled by dispatch",
          body: task.title,
          link: "/my-tasks",
          kind: "task.deleted",
        }
      : undefined,
  });

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.orgId, actor.orgId)));

  await recordAudit(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    action: "task.deleted",
    entity: "task",
    entityId: taskId,
    metadata: { title: task.title, status: task.status },
  });
}
