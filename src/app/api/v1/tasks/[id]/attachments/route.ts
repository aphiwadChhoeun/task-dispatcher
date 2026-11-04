import { revalidatePath } from "next/cache";
import { assertApiMutation } from "@/lib/csrf";
import { apiError, json, requireApiPermission } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { taskAttachments } from "@/lib/db/schema";
import { getTaskById } from "@/features/tasks/queries";
import { config } from "@/config";
import { storageKey, validateUpload } from "@/features/files/validation";
import { getStorage } from "@/features/files/storage";
import { publish } from "@/features/events";
import { NotFoundError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    requireApiPermission(session, "tasks.update");
    const { id } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, { status: 415 });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return json({ error: "Choose a file" }, { status: 422 });
    }

    const db = getDb();
    const task = await getTaskById(db, session.orgId, id);
    if (!task) throw new NotFoundError("Task not found");

    const validation = await validateUpload(file, config.uploads.documentMimes);
    if (!validation.ok) return json({ error: validation.error }, { status: 422 });

    const key = storageKey(session.orgId, "tasks", id, validation.file.extension, "attachment");
    await getStorage().put(key, await file.arrayBuffer(), {
      contentType: validation.file.mimeType,
      fileName: file.name,
    });

    const attachmentId = crypto.randomUUID();
    await db.insert(taskAttachments).values({
      id: attachmentId,
      orgId: session.orgId,
      taskId: id,
      uploadedBy: session.user.id,
      r2Key: key,
      fileName: file.name.slice(0, 200),
      mimeType: validation.file.mimeType,
      size: validation.file.size,
    });

    await publish({
      type: "task.attachment_added",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: { taskId: id, title: task.title, attachmentId },
      audience: {
        roles: ["admin", "dispatcher"],
        ...(task.taskerId ? { userIds: [task.taskerId] } : {}),
      },
    });

    revalidatePath(`/tasks/${id}`);
    return json({ ok: true, id: attachmentId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
