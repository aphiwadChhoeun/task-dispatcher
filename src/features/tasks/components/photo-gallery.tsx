import { Camera } from "lucide-react";
import { fileUrl } from "@/features/files/url";
import type { TaskPhoto } from "@/lib/db/schema";
import { formatDateTime, titleCase } from "@/lib/format";
import { PhotoGalleryGrid, type PhotoViewerItem } from "./photo-gallery-grid";

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

  const items: PhotoViewerItem[] = photos.map(({ photo, uploaderName }) => ({
    id: photo.id,
    url: fileUrl(photo.r2Key),
    alt: photo.caption ?? `${titleCase(photo.kind)} proof photo`,
    kind: photo.kind,
    caption: photo.caption,
    uploaderName,
    createdAtLabel: formatDateTime(photo.createdAt),
  }));

  return <PhotoGalleryGrid photos={items} />;
}
