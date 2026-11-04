"use client";

import { useActionState } from "react";
import { Paperclip, Upload } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { uploadTaskAttachmentAction } from "@/features/tasks/actions";
import type { TaskFormState } from "@/features/tasks/form-state";

export function AttachmentUpload({ taskId }: { taskId: string }) {
  const [state, formAction] = useActionState(uploadTaskAttachmentAction, {} as TaskFormState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input/80 bg-muted/35 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70">
        <Paperclip className="size-4" aria-hidden />
        <span className="flex-1 truncate">Choose a reference file (PDF, image, text)</span>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
          className="sr-only"
        />
      </label>
      <SubmitButton size="sm" variant="outline" pendingLabel="Uploading…">
        <Upload className="size-4" aria-hidden />
        Upload attachment
      </SubmitButton>
    </form>
  );
}
