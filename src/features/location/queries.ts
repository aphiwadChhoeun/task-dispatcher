import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { taskerPresence } from "@/lib/db/schema";
import { config } from "@/config";

export async function hasTaskerLocationSharing(
  db: Db,
  orgId: string,
  taskerId: string,
): Promise<boolean> {
  const row = await db
    .select({ updatedAt: taskerPresence.updatedAt })
    .from(taskerPresence)
    .where(and(eq(taskerPresence.orgId, orgId), eq(taskerPresence.taskerId, taskerId)))
    .get();
  if (!row) return false;
  return Date.now() - row.updatedAt.getTime() < config.location.staleSeconds * 1000;
}
