"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  grievanceAttachments,
  grievanceComments,
  grievances,
  memberships,
  tasks,
  users,
} from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { reportError } from "@/lib/observability";
import { assertCan, isDispatcherRole } from "@/lib/permissions";
import { requirePermission, requireUser } from "@/features/auth/session";
import { recordAudit } from "@/features/audit/log";
import { publish } from "@/features/events";
import { config } from "@/config";
import { storageKey, validateUpload } from "@/features/files/validation";
import { getStorage } from "@/features/files/storage";
import {
  grievanceCommentSchema,
  grievanceCreateSchema,
  grievanceUpdateSchema,
} from "./schemas";
import { getGrievanceById } from "./queries";

export type GrievanceFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

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

export async function createGrievanceAction(
  _prev: GrievanceFormState,
  formData: FormData,
): Promise<GrievanceFormState> {
  let grievanceId = "";
  try {
    await assertSameOrigin();
    const session = await requireUser();
    assertCan(session.user.role, "grievances.create");
    if (session.user.role !== "tasker") {
      throw new ForbiddenError("Only taskers can file a grievance");
    }

    const parsed = grievanceCreateSchema.safeParse({
      taskId: formData.get("taskId"),
      category: formData.get("category"),
      severity: formData.get("severity"),
      description: formData.get("description"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form" };
    }

    const db = getDb();
    const task = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, parsed.data.taskId),
          eq(tasks.orgId, session.orgId),
          eq(tasks.taskerId, session.user.id),
        ),
      )
      .get();
    if (!task) throw new NotFoundError("Task not found");

    const files = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, 3);

    const validated = [];
    for (const file of files) {
      const validation = await validateUpload(file, config.uploads.photoMimes);
      if (!validation.ok) return { error: validation.error };
      validated.push({ file, meta: validation.file });
    }

    grievanceId = crypto.randomUUID();
    const now = new Date();
    await db.insert(grievances).values({
      id: grievanceId,
      orgId: session.orgId,
      taskId: task.id,
      taskerId: session.user.id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      description: parsed.data.description,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    const storage = getStorage();
    for (const { file, meta } of validated) {
      try {
        const key = storageKey(session.orgId, "grievances", grievanceId, meta.extension, "photo");
        await storage.put(key, await file.arrayBuffer(), {
          contentType: meta.mimeType,
          fileName: file.name,
        });
        await db.insert(grievanceAttachments).values({
          orgId: session.orgId,
          grievanceId,
          uploadedBy: session.user.id,
          r2Key: key,
          fileName: file.name.slice(0, 200),
          mimeType: meta.mimeType,
          size: meta.size,
        });
      } catch (uploadError) {
        reportError(uploadError, { scope: "grievances.upload", grievanceId });
      }
    }

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "grievance.opened",
      entity: "grievance",
      entityId: grievanceId,
      metadata: {
        taskId: task.id,
        category: parsed.data.category,
        severity: parsed.data.severity,
      },
    });

    const dispatchers = await dispatcherIds(session.orgId);
    await publish({
      type: "grievance.opened",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        grievanceId,
        taskId: task.id,
        taskTitle: task.title,
        category: parsed.data.category,
        severity: parsed.data.severity,
        taskerName: session.user.name,
      },
      audience: {
        roles: ["admin", "dispatcher"],
        userIds: [session.user.id],
      },
      notification: {
        userIds: dispatchers,
        title: "New grievance filed",
        body: `${session.user.name}: ${parsed.data.description.slice(0, 120)}`,
        link: `/grievances/${grievanceId}`,
        kind: "grievance.opened",
      },
    });

    revalidatePath("/grievances");
    revalidatePath("/my-grievances");
    revalidatePath(`/my-tasks/${task.id}`);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "grievances.create" });
    return { error: "Could not file the grievance. Please try again." };
  }

  redirect(`/my-grievances/${grievanceId}`);
}

export async function addGrievanceCommentAction(
  _prev: GrievanceFormState,
  formData: FormData,
): Promise<GrievanceFormState> {
  try {
    await assertSameOrigin();
    const session = await requireUser();
    const parsed = grievanceCommentSchema.safeParse({
      grievanceId: formData.get("grievanceId"),
      body: formData.get("body"),
      isInternal: formData.get("isInternal") === "on",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the comment" };

    const db = getDb();
    const grievance = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, parsed.data.grievanceId),
          eq(grievances.orgId, session.orgId),
        ),
      )
      .get();
    if (!grievance) throw new NotFoundError("Grievance not found");

    const dispatcher = isDispatcherRole(session.user.role);
    if (!dispatcher && grievance.taskerId !== session.user.id) {
      throw new ForbiddenError("You cannot comment on this grievance");
    }
    if (parsed.data.isInternal && !dispatcher) {
      throw new ForbiddenError("Internal notes are dispatcher-only");
    }

    await db.insert(grievanceComments).values({
      orgId: session.orgId,
      grievanceId: grievance.id,
      authorId: session.user.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
      createdAt: new Date(),
    });

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "grievance.commented",
      entity: "grievance",
      entityId: grievance.id,
      metadata: { internal: parsed.data.isInternal },
    });

    const taskerRecipients = dispatcher && !parsed.data.isInternal ? [grievance.taskerId] : [];
    const dispatchRecipients = dispatcher ? [] : await dispatcherIds(session.orgId);
    await publish({
      type: "grievance.comment_added",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        grievanceId: grievance.id,
        taskId: grievance.taskId,
        authorName: session.user.name,
        internal: parsed.data.isInternal,
        body: parsed.data.body.slice(0, 160),
      },
      audience: parsed.data.isInternal
        ? { roles: ["admin", "dispatcher"] }
        : { roles: ["admin", "dispatcher"], userIds: [grievance.taskerId] },
      notification: {
        userIds: [...taskerRecipients, ...dispatchRecipients].filter(
          (id) => id !== session.user.id,
        ),
        title: `Grievance comment from ${session.user.name}`,
        body: parsed.data.body.slice(0, 140),
        link: dispatcher ? `/my-grievances/${grievance.id}` : `/grievances/${grievance.id}`,
        kind: "grievance.comment_added",
      },
    });

    revalidatePath(`/grievances/${grievance.id}`);
    revalidatePath(`/my-grievances/${grievance.id}`);
    return { success: "Comment added" };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "grievances.comment" });
    return { error: "Could not add the comment." };
  }
}

export async function updateGrievanceAction(
  _prev: GrievanceFormState,
  formData: FormData,
): Promise<GrievanceFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("grievances.manage");
    const parsed = grievanceUpdateSchema.safeParse({
      grievanceId: formData.get("grievanceId"),
      status: formData.get("status"),
      assigneeId: formData.get("assigneeId") || undefined,
      resolutionNotes: formData.get("resolutionNotes") || undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

    const db = getDb();
    const grievance = await getGrievanceById(db, session.orgId, parsed.data.grievanceId);
    if (!grievance) throw new NotFoundError("Grievance not found");

    let assigneeId: string | null = null;
    if (parsed.data.assigneeId) {
      const assignee = await db
        .select({ id: users.id })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.userId, parsed.data.assigneeId),
            eq(memberships.orgId, session.orgId),
            inArray(memberships.role, ["dispatcher", "admin"]),
            eq(memberships.status, "active"),
          ),
        )
        .get();
      if (!assignee) throw new AppError("Choose a dispatcher in your organization", 422);
      assigneeId = assignee.id;
    }

    const now = new Date();
    const resolved = parsed.data.status === "resolved" || parsed.data.status === "rejected";
    if (parsed.data.status === "resolved" && !parsed.data.resolutionNotes) {
      throw new AppError("Add resolution notes before resolving the grievance", 422);
    }
    await db
      .update(grievances)
      .set({
        status: parsed.data.status,
        assigneeId,
        resolutionNotes: parsed.data.resolutionNotes ?? null,
        resolvedAt: resolved ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(grievances.id, grievance.grievance.id),
          eq(grievances.orgId, session.orgId),
        ),
      );

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "grievance.updated",
      entity: "grievance",
      entityId: grievance.grievance.id,
      metadata: {
        fromStatus: grievance.grievance.status,
        status: parsed.data.status,
        assigneeId,
        resolutionNotes: parsed.data.resolutionNotes ?? null,
      },
    });

    await publish({
      type: "grievance.updated",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        grievanceId: grievance.grievance.id,
        taskId: grievance.grievance.taskId,
        status: parsed.data.status,
        resolutionNotes: parsed.data.resolutionNotes ?? null,
        assigneeName: session.user.name,
      },
      audience: {
        roles: ["admin", "dispatcher"],
        userIds: [grievance.grievance.taskerId],
      },
      notification: {
        userIds: [grievance.grievance.taskerId],
        title: `Grievance ${parsed.data.status.replaceAll("_", " ")}`,
        body: parsed.data.resolutionNotes?.slice(0, 140) ?? grievance.taskTitle ?? "Status updated",
        link: `/my-grievances/${grievance.grievance.id}`,
        kind: "grievance.updated",
      },
    });

    revalidatePath(`/grievances/${grievance.grievance.id}`);
    revalidatePath(`/my-grievances/${grievance.grievance.id}`);
    revalidatePath("/grievances");
    revalidatePath("/dashboard");
    return { success: "Grievance updated" };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "grievances.update" });
    return { error: "Could not update the grievance." };
  }
}
