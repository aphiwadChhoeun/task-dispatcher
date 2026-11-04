import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskPhoto } from "@/lib/db/schema";
import { formatDateTime, titleCase } from "@/lib/format";

function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function TaskPhotoGallery({
  photos,
}: {
  photos: Array<{ photo: TaskPhoto; uploaderName: string | null }>;
}) {
  if (photos.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        <Camera className="size-4" aria-hidden />
        No proof photos yet.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {photos.map(({ photo, uploaderName }) => (
        <li key={photo.id} className="group overflow-hidden rounded-2xl border border-border/85 bg-card shadow-card">
          <a href={fileUrl(photo.r2Key)} target="_blank" rel="noreferrer" className="block overflow-hidden">
            <img
              src={fileUrl(photo.r2Key)}
              alt={photo.caption ?? `${titleCase(photo.kind)} proof photo`}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </a>
          <div className="space-y-1 p-2.5">
            <Badge variant="secondary" className="capitalize">
              {photo.kind}
            </Badge>
            {photo.caption ? <p className="line-clamp-2 text-xs">{photo.caption}</p> : null}
            <p className="text-[11px] text-muted-foreground">
              {uploaderName ?? "Tasker"} · {formatDateTime(photo.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
