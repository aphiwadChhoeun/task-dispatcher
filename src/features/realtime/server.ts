import "server-only";
import { getAuthSecret, getEnv } from "@/lib/server-env";
import { reportError } from "@/lib/observability";
import type { EventAudience } from "@/lib/events";

export type RealtimeWireEvent = {
  id: string;
  type: string;
  at: number;
  actorId?: string;
  payload: Record<string, unknown>;
  audience?: EventAudience;
};

/**
 * Sends an event to the organization's Durable Object, which fans it out to
 * connected dispatchers/taskers. Failures are non-fatal: the UI polls when the
 * socket is unavailable.
 */
export async function notifyRealtime(orgId: string, event: RealtimeWireEvent): Promise<void> {
  try {
    const env = getEnv();
    if (!env.REALTIME) return;
    const stub = env.REALTIME.get(env.REALTIME.idFromName(orgId));
    const response = await stub.fetch("https://realtime.internal/broadcast", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": getAuthSecret(),
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      reportError(new Error(`Realtime broadcast failed (${response.status})`), {
        orgId,
        eventType: event.type,
      });
    }
  } catch (error) {
    reportError(error, { scope: "realtime.broadcast", orgId, eventType: event.type });
  }
}
