import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  announcementRecipients,
  announcements,
  users,
} from "@/lib/db/schema";

export async function listAnnouncementsForDispatcher(db: Db, orgId: string) {
  return db
    .select({
      announcement: announcements,
      senderName: users.name,
      recipients: sql<number>`(
        SELECT count(*) FROM announcement_recipients ar
        WHERE ar.announcement_id = ${announcements.id}
      )`,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.senderId, users.id))
    .where(eq(announcements.orgId, orgId))
    .orderBy(desc(announcements.createdAt))
    .limit(50);
}

export async function listAnnouncementsForTasker(
  db: Db,
  orgId: string,
  userId: string,
  limit = 10,
) {
  const rows = await db
    .select({
      announcement: announcements,
      senderName: users.name,
      readAt: announcementRecipients.readAt,
    })
    .from(announcementRecipients)
    .innerJoin(announcements, eq(announcements.id, announcementRecipients.announcementId))
    .leftJoin(users, eq(announcements.senderId, users.id))
    .where(
      and(
        eq(announcements.orgId, orgId),
        eq(announcementRecipients.userId, userId),
        eq(announcementRecipients.orgId, orgId),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(limit);

  if (rows.length > 0) {
    await db
      .update(announcementRecipients)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(announcementRecipients.userId, userId),
          eq(announcementRecipients.orgId, orgId),
          inArray(
            announcementRecipients.announcementId,
            rows.map((row) => row.announcement.id),
          ),
        ),
      );
  }

  return rows;
}

export async function listAllTaskerRecipients(db: Db, orgId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        eq(users.role, "tasker"),
        inArray(users.status, ["active", "invited"]),
      ),
    )
    .orderBy(asc(users.name));
}
