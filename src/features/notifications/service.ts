import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { notifications, pushSubscriptions } from "@/lib/db/schema";
import { config } from "@/config";
import { log, reportError } from "@/lib/observability";

export type NotificationPayload = {
  title: string;
  body?: string;
  link?: string;
  kind?: string;
};

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface NotificationSender {
  readonly name: string;
  send(target: PushTarget, notification: NotificationPayload): Promise<boolean>;
}

/**
 * Web Push needs VAPID keys and payload encryption. The MVP ships a no-op
 * sender so notifications work in-app and over WebSocket; add a sender that
 * talks to your push service here without changing feature code.
 */
class NoopPushSender implements NotificationSender {
  readonly name = "noop";
  async send(): Promise<boolean> {
    return false;
  }
}

let sender: NotificationSender = new NoopPushSender();

export function setNotificationSender(next: NotificationSender): void {
  sender = next;
}

export function getNotificationSender(): NotificationSender {
  return sender;
}

export async function notifyUsers(
  db: Db,
  orgId: string,
  userIds: string[],
  notification: NotificationPayload,
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;

  await db.insert(notifications).values(
    unique.map((userId) => ({
      orgId,
      userId,
      type: notification.kind ?? "info",
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    })),
  );

  if (!config.features.push) return;

  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.orgId, orgId), inArray(pushSubscriptions.userId, unique)),
      );
    await Promise.allSettled(
      subscriptions.map((sub) =>
        sender.send(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          notification,
        ),
      ),
    );
  } catch (error) {
    reportError(error, { scope: "notifications.push", orgId });
  }
}

export function logNotificationDelivery(userIds: string[], title: string): void {
  log("debug", "notification queued", { recipients: userIds.length, title });
}
