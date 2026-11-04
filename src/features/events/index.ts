import "./handlers";
import { publishDomainEvent, type DomainEvent, type DomainEventType, type EventAudience } from "@/lib/events";

export type PublishInput = {
  type: DomainEventType;
  orgId: string;
  actorId?: string;
  payload: Record<string, unknown>;
  audience?: EventAudience;
  notification?: DomainEvent["notification"];
};

export function createDomainEvent(input: PublishInput): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    orgId: input.orgId,
    actorId: input.actorId,
    at: Date.now(),
    payload: input.payload,
    audience: input.audience,
    notification: input.notification,
  };
}

export async function publish(input: PublishInput): Promise<DomainEvent> {
  const event = createDomainEvent(input);
  await publishDomainEvent(event);
  return event;
}

export { publishDomainEvent, type DomainEvent, type DomainEventType, type EventAudience };
