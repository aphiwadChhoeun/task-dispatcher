import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertApiMutation } from "@/lib/csrf";
import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { config } from "@/config";
import { storageKey, validateUpload } from "@/features/files/validation";
import { getStorage } from "@/features/files/storage";
import { getTaskConversation, sendTaskMessage, type MessageAttachment } from "@/features/messaging/service";

const messageSchema = z.object({
  body: z.string().trim().max(4000).default(""),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession(request);
    const { id } = await params;
    const conversation = await getTaskConversation(session.user, id);
    return json(conversation);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    const { id } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    let body = "";
    const attachments: MessageAttachment[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = String(formData.get("body") ?? "").trim();
      const file = formData.get("file");
      if (file instanceof File && file.size > 0) {
        const validation = await validateUpload(file, config.uploads.photoMimes);
        if (!validation.ok) return json({ error: validation.error }, { status: 422 });
        const key = storageKey(session.orgId, "tasks", id, validation.file.extension, "attachment");
        await getStorage().put(key, await file.arrayBuffer(), {
          contentType: validation.file.mimeType,
          fileName: file.name,
        });
        attachments.push({
          key,
          name: file.name.slice(0, 200),
          mime: validation.file.mimeType,
          size: validation.file.size,
        });
      }
    } else {
      const parsed = await request.json().catch(() => null);
      const result = messageSchema.safeParse(parsed);
      if (!result.success) return json({ error: "Invalid message" }, { status: 422 });
      body = result.data.body;
    }

    if (body.length > 4000) return json({ error: "Message is too long" }, { status: 422 });
    const message = await sendTaskMessage(session.user, id, body, attachments);
    revalidatePath(`/tasks/${id}`);
    revalidatePath(`/my-tasks/${id}`);
    return json({ message }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
