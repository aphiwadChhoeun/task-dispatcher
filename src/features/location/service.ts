import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { locations, taskerPresence } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { canShareLocation, type Role } from "@/lib/permissions";
import { getTaskById } from "@/features/tasks/queries";
import { publish } from "@/features/events";

type Actor = { id: string; orgId: string; role: Role; name: string };

export type LocationInput = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt?: number;
};

/** HTTP fallback used when the WebSocket is unavailable (including next dev). */
export async function recordTaskLocation(
  actor: Actor,
  taskId: string,
  input: LocationInput,
): Promise<{ updatedAt: number }> {
  const db = getDb();
  const task = await getTaskById(db, actor.orgId, taskId);
  if (!task) throw new NotFoundError("Task not found");
  if (
    !canShareLocation(
      { id: actor.id, role: actor.role, orgId: actor.orgId },
      task,
    )
  ) {
    throw new ForbiddenError("Location sharing is only available while a task is active");
  }
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    throw new ForbiddenError("Invalid coordinates");
  }

  const now = Date.now();
  const recordedAt = new Date(
    Number.isFinite(input.recordedAt)
      ? Math.min(Math.max(Number(input.recordedAt), now - 5 * 60_000), now + 60_000)
      : now,
  );

  await db.batch([
    db.insert(locations).values({
      orgId: actor.orgId,
      taskerId: actor.id,
      taskId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      recordedAt,
    }),
    db
      .insert(taskerPresence)
      .values({
        taskerId: actor.id,
        orgId: actor.orgId,
        taskId,
        taskStatus: task.status,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy ?? null,
        heading: input.heading ?? null,
        speed: input.speed ?? null,
        updatedAt: recordedAt,
      })
      .onConflictDoUpdate({
        target: taskerPresence.taskerId,
        set: {
          orgId: actor.orgId,
          taskId,
          taskStatus: task.status,
          lat: input.lat,
          lng: input.lng,
          accuracy: input.accuracy ?? null,
          heading: input.heading ?? null,
          speed: input.speed ?? null,
          updatedAt: recordedAt,
        },
      }),
  ]);

  await publish({
    type: "location.updated",
    orgId: actor.orgId,
    actorId: actor.id,
    payload: {
      taskerId: actor.id,
      taskerName: actor.name,
      taskId,
      taskStatus: task.status,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy ?? null,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      updatedAt: recordedAt.getTime(),
      stale: false,
    },
    audience: { roles: ["admin", "dispatcher"] },
  });

  return { updatedAt: recordedAt.getTime() };
}

export async function clearTaskerPresence(orgId: string, taskerId: string, taskId: string) {
  const db = getDb();
  await db
    .delete(taskerPresence)
    .where(
      and(
        eq(taskerPresence.orgId, orgId),
        eq(taskerPresence.taskerId, taskerId),
        eq(taskerPresence.taskId, taskId),
      ),
    );
}
