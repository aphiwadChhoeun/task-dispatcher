import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/status-badges";
import type { TaskEvent } from "@/lib/db/schema";
import { formatDateTime, titleCase } from "@/lib/format";

type TimelineItem = {
  event: TaskEvent;
  actorName: string | null;
  actorRole: string | null;
};

export function TaskTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {items.map(({ event, actorName, actorRole }) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[27px] top-1 flex size-3 items-center justify-center rounded-full border-2 border-card bg-primary" aria-hidden />
          <div className="flex flex-wrap items-center gap-1.5">
            {event.fromStatus ? (
              <>
                <StatusBadge status={event.fromStatus as never} />
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              </>
            ) : null}
            <StatusBadge status={event.toStatus as never} />
          </div>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{actorName ?? "System"}</span>
            {actorRole ? <span className="text-muted-foreground"> · {titleCase(actorRole)}</span> : null}
            <span className="text-muted-foreground"> · {formatDateTime(event.createdAt)}</span>
          </p>
          {event.note ? <p className="mt-0.5 text-sm text-muted-foreground">{event.note}</p> : null}
          {event.lat != null && event.lng != null ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              at {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
