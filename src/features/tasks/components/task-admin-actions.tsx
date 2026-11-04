"use client";

import { useActionState, useState } from "react";
import { Trash2, UserRoundCog } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteTaskAction, reassignTaskAction } from "@/features/tasks/actions";
import type { TaskFormState } from "@/features/tasks/form-state";

export function ReassignForm({
  taskId,
  currentTaskerId,
  taskers,
}: {
  taskId: string;
  currentTaskerId: string | null;
  taskers: Array<{ id: string; name: string; status: string }>;
}) {
  const [state, formAction] = useActionState(reassignTaskAction, {} as TaskFormState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      <Select name="taskerId" defaultValue={currentTaskerId ?? ""} aria-label="Assign to tasker" required>
        <option value="">Choose a tasker…</option>
        {taskers.map((tasker) => (
          <option key={tasker.id} value={tasker.id}>
            {tasker.name}
            {tasker.status !== "active" ? ` (${tasker.status})` : ""}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="outline" pendingLabel="Reassigning…">
        <UserRoundCog className="size-4" aria-hidden />
        Reassign task
      </SubmitButton>
    </form>
  );
}

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    );
  }

  return (
    <form
      action={deleteTaskAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Delete this task and all of its photos and messages? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <span className="text-xs text-destructive">Permanently delete this task?</span>
      <SubmitButton size="sm" variant="destructive" pendingLabel="Deleting…">
        Yes, delete
      </SubmitButton>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </form>
  );
}
