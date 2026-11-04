"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/features/files/storage";
import { requirePermission, requireUser } from "@/features/auth/session";
import { assertCan } from "@/lib/permissions";
import { reportError } from "@/lib/observability";
import {
  deleteTaskSchema,
  reassignTaskSchema,
  taskFormSchema,
  taskStatusTransitionSchema,
} from "./schemas";
import {
  cancelTask,
  changeTaskStatus,
  createTask,
  deleteTask,
  reassignTask,
  updateTask,
} from "./service";
import { flattenZodError } from "@/lib/validation";
import type { TaskFormState } from "./form-state";

function revalidateTask(taskId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-tasks");
  revalidatePath(`/my-tasks/${taskId}`);
  revalidatePath("/live");
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  let newId: string;
  try {
    await assertSameOrigin();
    const session = await requirePermission("tasks.create");
    const values = taskFormSchema.parse(
      Object.fromEntries(
        [...new Set(formData.keys())].map((key) => [key, formData.get(key) ?? undefined]),
      ),
    );
    newId = await createTask(session.user, values);
    revalidateTask(newId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    if (error && typeof error === "object" && "issues" in error) {
      return { fieldErrors: flattenZodError(error as never) };
    }
    reportError(error, { scope: "tasks.create" });
    return { error: "Could not create the task. Please try again." };
  }
  redirect(`/tasks/${newId}`);
}

export async function updateTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  let taskId = "";
  try {
    await assertSameOrigin();
    const session = await requirePermission("tasks.update");
    taskId = String(formData.get("taskId") ?? "");
    if (!taskId) return { error: "Missing task id" };
    const values = taskFormSchema.parse(
      Object.fromEntries(
        [...new Set(formData.keys())]
          .filter((key) => key !== "taskId")
          .map((key) => [key, formData.get(key) ?? undefined]),
      ),
    );
    await updateTask(session.user, taskId, values);
    revalidateTask(taskId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    if (error && typeof error === "object" && "issues" in error) {
      return { fieldErrors: flattenZodError(error as never) };
    }
    reportError(error, { scope: "tasks.update", taskId });
    return { error: "Could not save the task. Please try again." };
  }
  redirect(`/tasks/${taskId}`);
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const parsed = deleteTaskSchema.parse({
    taskId: formData.get("taskId"),
  });
  await assertSameOrigin();
  const session = await requirePermission("tasks.delete");
  await deleteTask(session.user, parsed.taskId);
  revalidateTask(parsed.taskId);
  redirect("/tasks");
}

export async function transitionTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  let taskId = "";
  let redirectTo = "/";
  try {
    await assertSameOrigin();
    const session = await requireUser();
    assertCan(
      session.user.role,
      session.user.role === "tasker" ? "tasks.status.update.own" : "tasks.status.update.any",
    );
    const parsed = taskStatusTransitionSchema.parse({
      taskId: formData.get("taskId"),
      to: formData.get("to"),
      note: formData.get("note") || undefined,
      lat: formData.get("lat") || undefined,
      lng: formData.get("lng") || undefined,
    });
    taskId = parsed.taskId;
    await changeTaskStatus({
      actor: session.user,
      taskId,
      to: parsed.to,
      note: parsed.note,
      lat: parsed.lat,
      lng: parsed.lng,
    });
    revalidateTask(taskId);
    redirectTo = session.user.role === "tasker" ? `/my-tasks/${taskId}` : `/tasks/${taskId}`;
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    if (error && typeof error === "object" && "issues" in error) {
      return { fieldErrors: flattenZodError(error as never) };
    }
    reportError(error, { scope: "tasks.transition", taskId });
    return { error: "Could not update the task status. Please try again." };
  }
  redirect(redirectTo);
}

export async function cancelTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  let taskId = "";
  try {
    await assertSameOrigin();
    const session = await requirePermission("tasks.cancel");
    taskId = String(formData.get("taskId") ?? "");
    if (!taskId) return { error: "Missing task id" };
    await cancelTask(session.user, taskId, String(formData.get("note") ?? ""));
    revalidateTask(taskId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "tasks.cancel", taskId });
    return { error: "Could not cancel the task." };
  }
  redirect(`/tasks/${taskId}`);
}

export async function reassignTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  let taskId = "";
  try {
    await assertSameOrigin();
    const session = await requirePermission("tasks.assign");
    const parsed = reassignTaskSchema.parse({
      taskId: formData.get("taskId"),
      taskerId: formData.get("taskerId"),
      note: formData.get("note") || undefined,
    });
    taskId = parsed.taskId;
    await reassignTask(session.user, parsed.taskId, parsed.taskerId, parsed.note);
    revalidateTask(taskId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    if (error && typeof error === "object" && "issues" in error) {
      return { fieldErrors: flattenZodError(error as never) };
    }
    reportError(error, { scope: "tasks.reassign", taskId });
    return { error: "Could not reassign the task." };
  }
  redirect(`/tasks/${taskId}`);
}

/** Attaches dispatcher reference files to a task. */
export async function uploadTaskAttachmentAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("tasks.update");
    const taskId = String(formData.get("taskId") ?? "");
    const file = formData.get("file");
    if (!taskId) return { error: "Missing task id" };
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };

    const db = getDb();
    const task = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, session.user.orgId)))
      .get();
    if (!task) return { error: "Task not found" };

    const { validateUpload, storageKey } = await import("@/features/files/validation");
    const { config } = await import("@/config");
    const validation = await validateUpload(file, config.uploads.documentMimes);
    if (!validation.ok) return { error: validation.error };

    const key = storageKey(
      session.user.orgId,
      "tasks",
      taskId,
      validation.file.extension,
      "attachment",
    );
    await getStorage().put(key, await file.arrayBuffer(), {
      contentType: validation.file.mimeType,
      fileName: file.name,
    });

    const { taskAttachments } = await import("@/lib/db/schema");
    await db.insert(taskAttachments).values({
      orgId: session.user.orgId,
      taskId,
      uploadedBy: session.user.id,
      r2Key: key,
      fileName: file.name.slice(0, 200),
      mimeType: validation.file.mimeType,
      size: validation.file.size,
    });

    revalidateTask(taskId);
    return {};
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "tasks.attachment" });
    return { error: "Could not upload the attachment." };
  }
}
