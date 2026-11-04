import { formatDateTime, titleCase } from "@/lib/format";

type AuditRow = {
  log: {
    id: string;
    action: string;
    actorId: string | null;
    metadata: string | null;
    createdAt: Date;
  };
  actorName: string | null;
};

export function GrievanceAudit({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit entries yet.</p>;
  }

  return (
    <ol className="space-y-2 text-sm">
      {rows.map(({ log, actorName }) => (
        <li key={log.id} className="rounded-xl border border-border/85 bg-card/60 px-3 py-2.5">
          <p className="font-medium">
            {titleCase(log.action.replace("grievance.", ""))}
            {actorName ? <span className="font-normal text-muted-foreground"> · {actorName}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
