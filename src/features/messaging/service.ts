import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memberships, messages, users } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError, AppError } from "@/lib/errors";
import { canReadTaskMessages, isDispatcherRole, type Role } from "@/lib/permissions";
import { publish } from "@/features/events";
import {
  ensureTaskThread,
  getTaskById,
  listThreadMessages,
  markThreadRead,
  getThreadReads,
} from "@/features/tasks/queries";

export type MessageAttachment = {
  key: string;
  name: string;
  mime: string;
  size: number;
};

type Actor = { id: string; orgId: string; role: Role; name: string };

async function dispatcherIds(orgId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.orgId, orgId),
        inArray(memberships.role, ["dispatcher", "admin"]),
        eq(memberships.status, "active"),
      ),
    );
  return rows.map((row) => row.id);
}

export async function sendTaskMessage(
  actor: Actor,
  taskId: string,
  body: string,
  attachments: MessageAttachment[] = [],
) {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");
  if (!canReadTaskMessages({ id: actor.id, role: actor.role, orgId: actor.orgId }, task)) {
    throw new ForbiddenError("You cannot message on this task");
  }
  if (!body.trim() && attachments.length === 0) {
    throw new AppError("Write a message or attach a photo", 422);
  }

  const threadId = await ensureTaskThread(db, actor.orgId, taskId);
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(messages).values({
    id,
    orgId: actor.orgId,
    threadId,
    senderId: actor.id,
    body: body.trim().slice(0, 4000),
    attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
    createdAt: now,
  });

  await markThreadRead(db, actor.orgId, threadId, actor.id);

  const dispatcherRecipients = isDispatcherRole(actor.role)
    ? []
    : await dispatcherIds(actor.orgId);
  const recipients = isDispatcherRole(actor.role)
    ? task.taskerId
      ? [task.taskerId]
      : []
    : dispatcherRecipients;

  await publish({
    type: "message.created",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: {
      taskId,
      title: task.title,
      messageId: id,
      senderId: actor.id,
      senderName: actor.name,
      body: body.trim().slice(0, 140),
      hasAttachment: attachments.length > 0,
    },
    audience: {
      roles: ["admin", "dispatcher"],
      ...(task.taskerId ? { userIds: [task.taskerId] } : {}),
    },
    notification: {
      userIds: recipients.filter((userId) => userId !== actor.id),
      title: `New message from ${actor.name}`,
      body: body.trim().slice(0, 140) || "Sent a photo",
      link: isDispatcherRole(actor.role) ? `/my-tasks/${taskId}` : `/tasks/${taskId}`,
      kind: "message.created",
    },
  });

  return {
    id,
    taskId,
    threadId,
    senderId: actor.id,
    senderName: actor.name,
    body: body.trim(),
    attachments,
    createdAt: now.toISOString(),
  };
}

export async function getTaskConversation(
  actor: Actor,
  taskId: string,
) {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");
  if (!canReadTaskMessages({ id: actor.id, role: actor.role, orgId: actor.orgId }, task)) {
    throw new ForbiddenError("You cannot read messages for this task");
  }

  const threadId = await ensureTaskThread(db, actor.orgId, taskId);
  const [items, reads] = await Promise.all([
    listThreadMessages(db, actor.orgId, threadId, 200),
    getThreadReads(db, actor.orgId, threadId),
  ]);
  await markThreadRead(db, actor.orgId, threadId, actor.id);

  return {
    threadId,
    currentUserId: actor.id,
    messages: items.map((row) => ({
      ...row,
      attachments: parseAttachments(row.attachments),
      createdAt: row.createdAt.toISOString(),
    })),
    reads: reads.map((read) => ({
      userId: read.userId,
      lastReadAt: read.lastReadAt.toISOString(),
    })),
  };
}

export function parseAttachments(raw: string | null): MessageAttachment[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is MessageAttachment =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as MessageAttachment).key === "string",
    );
  } catch {
    return [];
  }
}
