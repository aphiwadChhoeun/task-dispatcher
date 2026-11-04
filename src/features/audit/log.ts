import "server-only";
import type { Db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditInput = {
  orgId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Append-only audit trail for sensitive actions (grievances, tasker changes). */
export async function recordAudit(db: Db, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
