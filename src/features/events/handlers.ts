import "server-only";
import { onDomainEvent } from "@/lib/events";
import { notifyRealtime } from "@/features/realtime/server";
import { notifyUsers } from "@/features/notifications/service";
import { getDb } from "@/lib/db";
import { reportError } from "@/lib/observability";

export function registerDefaultEventHandlers(): void {
  onDomainEvent(async (event) => {
    await notifyRealtime(event.orgId, {
      id: event.id,
      type: event.type,
      at: event.at,
      actorId: event.actorId,
      payload: event.payload,
      audience: event.audience,
    });

    if (event.notification) {
      try {
        await notifyUsers(getDb(), event.orgId, event.notification.userIds, {
          title: event.notification.title,
          body: event.notification.body,
          link: event.notification.link,
          kind: event.notification.kind ?? event.type,
        });
      } catch (error) {
        reportError(error, { scope: "events.notifications", type: event.type });
      }
    }
  });
}

registerDefaultEventHandlers();
