"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { addGrievanceCommentAction, type GrievanceFormState } from "@/features/grievances/actions";

export function GrievanceCommentForm({
  grievanceId,
  allowInternal,
}: {
  grievanceId: string;
  allowInternal: boolean;
}) {
  const [state, formAction] = useActionState(addGrievanceCommentAction, {} as GrievanceFormState);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="grievanceId" value={grievanceId} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Textarea
        name="body"
        rows={3}
        required
        maxLength={3000}
        placeholder="Add a comment or update…"
        aria-label="Comment"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowInternal ? (
          <label className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="isInternal" className="size-4 accent-[#0d5f4c]" />
            Internal note (not visible to tasker)
          </label>
        ) : (
          <span />
        )}
        <SubmitButton size="sm" pendingLabel="Posting…">
          Post comment
        </SubmitButton>
      </div>
    </form>
  );
}
