import { FileText } from "lucide-react";
import type { GrievanceAttachment } from "@/lib/db/schema";
import { formatDateTime, humanFileSize } from "@/lib/format";

function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function GrievanceAttachments({ attachments }: { attachments: GrievanceAttachment[] }) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  const files = attachments.filter((attachment) => !attachment.mimeType.startsWith("image/"));

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {images.map((attachment) => (
            <li key={attachment.id} className="overflow-hidden rounded-xl border border-border/85 shadow-card">
              <a href={fileUrl(attachment.r2Key)} target="_blank" rel="noreferrer">
                <img
                  src={fileUrl(attachment.r2Key)}
                  alt={attachment.fileName}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/85">
          {files.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={fileUrl(attachment.r2Key)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/70"
              >
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                <span className="text-xs text-muted-foreground">{humanFileSize(attachment.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Attached {formatDateTime(attachments[0].createdAt)}
      </p>
    </div>
  );
}
