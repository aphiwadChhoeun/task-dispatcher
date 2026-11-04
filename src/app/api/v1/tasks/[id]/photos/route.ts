import { revalidatePath } from "next/cache";
import { assertApiMutation } from "@/lib/csrf";
import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { taskPhotos } from "@/lib/db/schema";
import { canViewTask } from "@/lib/permissions";
import { getTaskById } from "@/features/tasks/queries";
import { config } from "@/config";
import { storageKey, validateUpload } from "@/features/files/validation";
import { getStorage } from "@/features/files/storage";
import { uploadMetaSchema } from "@/features/tasks/schemas";
import { publish } from "@/features/events";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    const { id } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return json({ error: "Choose a photo to upload" }, { status: 422 });
    }

    const db = getDb();
    const task = await getTaskById(db, session.orgId, id);
    if (!task) throw new NotFoundError("Task not found");
    if (!canViewTask(session.user, task)) throw new ForbiddenError("You cannot access this task");

    const meta = uploadMetaSchema.parse({
      kind: formData.get("kind") || "other",
      caption: formData.get("caption") || undefined,
    });
    const validation = await validateUpload(file, config.uploads.photoMimes);
    if (!validation.ok) return json({ error: validation.error }, { status: 422 });

    const key = storageKey(session.orgId, "tasks", id, validation.file.extension, "photo");
    await getStorage().put(key, await file.arrayBuffer(), {
      contentType: validation.file.mimeType,
      fileName: file.name,
    });

    const photoId = crypto.randomUUID();
    await db.insert(taskPhotos).values({
      id: photoId,
      orgId: session.orgId,
      taskId: id,
      uploadedBy: session.user.id,
      r2Key: key,
      caption: meta.caption ?? null,
      kind: meta.kind,
      mimeType: validation.file.mimeType,
      size: validation.file.size,
    });

    await publish({
      type: "task.photo_added",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        taskId: id,
        title: task.title,
        photoId,
        kind: meta.kind,
        uploadedBy: session.user.id,
      },
      audience: {
        roles: ["admin", "dispatcher"],
        ...(task.taskerId ? { userIds: [task.taskerId] } : {}),
      },
    });

    revalidatePath(`/tasks/${id}`);
    revalidatePath(`/my-tasks/${id}`);

    return json(
      {
        photo: {
          id: photoId,
          url: `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`,
          kind: meta.kind,
          caption: meta.caption ?? null,
          mimeType: validation.file.mimeType,
          size: validation.file.size,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
