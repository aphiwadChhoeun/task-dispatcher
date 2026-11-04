"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, UploadCloud } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { compressImage } from "@/lib/image-compress";
import { enqueuePhoto, getQueuedForTask } from "@/lib/offline-queue";

export function PhotoUpload({ taskId }: { taskId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState("during");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [online, setOnline] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    void getQueuedForTask(taskId).then((queued) => setQueuedCount(queued.photos.length));
  }, [taskId]);

  const chooseFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = Array.from(event.target.files ?? []).slice(0, 4);
    if (selected.length === 0) return;
    const compressed = await Promise.all(selected.map((file) => compressImage(file)));
    setFiles(compressed);
    event.target.value = "";
  };

  const upload = async () => {
    if (files.length === 0) return;
    setError(null);

    if (!navigator.onLine) {
      for (const file of files) {
        await enqueuePhoto({
          taskId,
          blob: file,
          filename: file.name,
          mimeType: file.type,
          kind,
          caption: caption.trim() || undefined,
        });
      }
      setQueuedCount((count) => count + files.length);
      setFiles([]);
      setCaption("");
      return;
    }

    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("kind", kind);
        if (caption.trim()) formData.set("caption", caption.trim());
        const response = await fetch(`/api/v1/tasks/${taskId}/photos`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Upload failed");
        }
        uploaded += 1;
      }
      setFiles([]);
      setCaption("");
      router.refresh();
    } catch (uploadError) {
      setError(
        `${uploaded > 0 ? `${uploaded} photo(s) uploaded. ` : ""}${
          uploadError instanceof Error ? uploadError.message : "Could not upload photos"
        }`,
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {queuedCount > 0 ? (
        <Alert variant="warning">
          {queuedCount} photo{queuedCount === 1 ? "" : "s"} queued for upload. They will sync when
          you are online.
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-input/80 bg-muted/35 px-3 text-sm font-medium transition-colors hover:bg-muted/70">
          <Camera className="size-4" aria-hidden />
          {files.length > 0 ? `${files.length} photo(s) selected` : "Choose photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={chooseFiles}
          />
        </label>
        <Select aria-label="Photo stage" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="before">Before</option>
          <option value="during">During</option>
          <option value="after">After</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <Input
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Caption (optional)"
        maxLength={300}
        aria-label="Photo caption"
      />
      {files.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="truncate">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        onClick={upload}
        disabled={files.length === 0 || uploading}
        className="w-full sm:w-auto"
      >
        <UploadCloud className="size-4" aria-hidden />
        {uploading ? "Uploading…" : online ? "Upload photos" : "Queue photos"}
      </Button>
    </div>
  );
}

