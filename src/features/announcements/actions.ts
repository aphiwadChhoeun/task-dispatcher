"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { announcementRecipients, announcements, users } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError } from "@/lib/errors";
import { reportError } from "@/lib/observability";
import { requirePermission } from "@/features/auth/session";
import { publish } from "@/features/events";

export type AnnouncementFormState = {
  error?: string;
  success?: string;
};

const announcementSchema = z.object({
  body: z.string().trim().min(3, "Write an announcement").max(2000),
  recipientIds: z.array(z.uuid()).min(1, "Choose at least one tasker"),
});

export async function createAnnouncementAction(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("broadcasts.send");
    const recipientIds = formData
      .getAll("recipientIds")
      .map(String)
      .filter(Boolean);
    const parsed = announcementSchema.safeParse({
      body: formData.get("body"),
      recipientIds,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the announcement" };
    }

    const db = getDb();
    const recipients = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        and(
          eq(users.orgId, session.orgId),
          eq(users.role, "tasker"),
          inArray(users.id, parsed.data.recipientIds),
        ),
      );
    if (recipients.length === 0) {
      return { error: "Choose at least one tasker in your organization" };
    }

    const announcementId = crypto.randomUUID();
    const now = new Date();
    await db.batch([
      db.insert(announcements).values({
        id: announcementId,
        orgId: session.orgId,
        senderId: session.user.id,
        body: parsed.data.body,
        createdAt: now,
      }),
      db.insert(announcementRecipients).values(
        recipients.map((recipient) => ({
          orgId: session.orgId,
          announcementId,
          userId: recipient.id,
          readAt: null,
        })),
      ),
    ]);

    await publish({
      type: "announcement.created",
      orgId: session.orgId,
      actorId: session.user.id,
      payload: {
        announcementId,
        body: parsed.data.body.slice(0, 140),
        senderName: session.user.name,
      },
      audience: { userIds: recipients.map((recipient) => recipient.id) },
      notification: {
        userIds: recipients.map((recipient) => recipient.id),
        title: "Dispatch announcement",
        body: parsed.data.body.slice(0, 140),
        link: "/my-tasks",
        kind: "announcement.created",
      },
    });

    revalidatePath("/announcements");
    revalidatePath("/my-tasks");
    revalidatePath("/dashboard");
    return { success: `Announcement sent to ${recipients.length} tasker(s).` };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "announcements.create" });
    return { error: "Could not send the announcement." };
  }
}
