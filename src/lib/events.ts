import type { Role } from "@/lib/permissions";

export type DomainEventType =
  | "task.created"
  | "task.assigned"
  | "task.updated"
  | "task.deleted"
  | "task.status_changed"
  | "task.photo_added"
  | "task.attachment_added"
  | "message.created"
  | "announcement.created"
  | "grievance.opened"
  | "grievance.updated"
  | "grievance.comment_added"
  | "location.updated";

export type EventAudience = {
  roles?: Role[];
  userIds?: string[];
};

export type DomainEvent = {
  id: string;
  type: DomainEventType;
  orgId: string;
  actorId?: string;
  at: number;
  payload: Record<string, unknown>;
  audience?: EventAudience;
  notification?: {
    userIds: string[];
    title: string;
    body?: string;
    link?: string;
    kind?: string;
  };
};

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

const handlers = new Set<DomainEventHandler>();

/**
 * Feature modules register handlers here. Keeping the bus in-process is enough
 * for Workers; durable side effects (audit log, D1 writes) happen inside the
 * server action itself and are never lost if a handler fails.
 */
export function onDomainEvent(handler: DomainEventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export async function publishDomainEvent(event: DomainEvent): Promise<void> {
  if (handlers.size === 0) return;
  const results = await Promise.allSettled([...handlers].map((handler) => handler(event)));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[events] handler failed", event.type, result.reason);
    }
  }
}
