"use client";

import { useActionState, useState } from "react";
import { Mail, Power, RotateCw } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import {
  resendTaskerInviteAction,
  setTaskerStatusAction,
  type TaskerFormState,
} from "@/features/taskers/actions";
import { InviteLink } from "@/features/taskers/components/invite-link";

export function TaskerStatusForm({
  taskerId,
  status,
}: {
  taskerId: string;
  status: string;
}) {
  const [state, formAction] = useActionState(setTaskerStatusAction, {} as TaskerFormState);
  const nextStatus = status === "deactivated" ? "active" : "deactivated";

  if (status === "invited") return null;

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          nextStatus === "deactivated" &&
          !window.confirm("Deactivate this tasker? They will be signed out immediately.")
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="taskerId" value={taskerId} />
      <input type="hidden" name="status" value={nextStatus} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <Button
        type="submit"
        size="sm"
        variant={nextStatus === "deactivated" ? "outline" : "secondary"}
      >
        <Power className="size-4" aria-hidden />
        {nextStatus === "deactivated" ? "Deactivate tasker" : "Reactivate tasker"}
      </Button>
    </form>
  );
}

export function ResendInviteForm({ taskerId }: { taskerId: string }) {
  const [state, formAction] = useActionState(resendTaskerInviteAction, {} as TaskerFormState);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}
      {!open ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <RotateCw className="size-4" aria-hidden />
          New invite link
        </Button>
      ) : (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="taskerId" value={taskerId} />
          <Button type="submit" size="sm" variant="secondary">
            <Mail className="size-4" aria-hidden />
            Generate link
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
