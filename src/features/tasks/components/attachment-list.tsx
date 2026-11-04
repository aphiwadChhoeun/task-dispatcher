import { Download, FileText } from "lucide-react";
import type { TaskAttachment } from "@/lib/db/schema";
import { formatDateTime, humanFileSize } from "@/lib/format";

function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function AttachmentList({ attachments }: { attachments: TaskAttachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No reference attachments.</p>;
  }

  return (
    <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/85 bg-card">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <a
            href={fileUrl(attachment.r2Key)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/70"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{attachment.fileName}</span>
              <span className="block text-[11px] text-muted-foreground">
                {humanFileSize(attachment.size)} · {formatDateTime(attachment.createdAt)}
              </span>
            </span>
            <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
