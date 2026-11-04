"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PauseCircle,
  Play,
  Truck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { transitionTaskAction } from "@/features/tasks/actions";
import type { TaskFormState } from "@/features/tasks/form-state";
import type { TaskStatus } from "@/lib/db/schema";
import { enqueueStatus } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

export type TaskTransition = {
  to: TaskStatus;
  requiresNote: boolean;
  destructive?: boolean;
};

const LABELS: Record<TaskStatus, string> = {
  assigned: "Resume task",
  accepted: "Accept task",
  en_route: "Start driving",
  in_progress: "Start work",
  completed: "Mark complete",
  rejected: "Reject task",
  cancelled: "Cancel task",
  on_hold: "Put on hold",
};

const ICONS: Record<TaskStatus, React.ElementType> = {
  assigned: Play,
  accepted: CheckCircle2,
  en_route: Truck,
  in_progress: Wrench,
  completed: CheckCircle2,
  rejected: XCircle,
  cancelled: Ban,
  on_hold: PauseCircle,
};

export function TaskStatusActions({
  taskId,
  taskTitle,
  transitions,
}: {
  taskId: string;
  taskTitle: string;
  transitions: TaskTransition[];
}) {
  const [state, formAction] = useActionState(transitionTaskAction, {} as TaskFormState);
  const [modal, setModal] = useState<TaskTransition | null>(null);
  const [note, setNote] = useState("");
  const [queued, setQueued] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setQueued(null);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  if (transitions.length === 0) {
    return <p className="text-sm text-muted-foreground">No status actions are available right now.</p>;
  }

  const queueOffline = async (transition: TaskTransition, queuedNote?: string) => {
    if (transition.requiresNote && (!queuedNote || queuedNote.trim().length < 3)) {
      setNoteError("Add a short reason before continuing.");
      return false;
    }
    await enqueueStatus({
      taskId,
      to: transition.to,
      note: queuedNote?.trim() || undefined,
      taskTitle,
    });
    setQueued(LABELS[transition.to]);
    setModal(null);
    setNote("");
    return true;
  };

  const defaultTransitions = transitions.filter(
    (transition) => !transition.requiresNote && !transition.destructive,
  );
  const modalTransitions = transitions.filter(
    (transition) => transition.requiresNote || transition.destructive,
  );

  return (
    <div className="space-y-3">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.fieldErrors?.note ? <Alert variant="error">{state.fieldErrors.note}</Alert> : null}
      {queued ? (
        <Alert variant="success">
          {queued} queued. It will sync automatically when you are back online.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {defaultTransitions.map((transition) => {
          const Icon = ICONS[transition.to];
          return (
            <form
              key={transition.to}
              action={formAction}
              className="sm:w-auto"
              onSubmit={async (event) => {
                if (navigator.onLine) return;
                event.preventDefault();
                await queueOffline(transition);
              }}
            >
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="to" value={transition.to} />
              <SubmitButton
                className="w-full sm:w-auto"
                variant={transition.to === "completed" ? "success" : "default"}
                pendingLabel="Updating…"
              >
                <Icon className="size-4" aria-hidden />
                {transition.to === "completed" ? "Mark complete" : LABELS[transition.to]}
              </SubmitButton>
            </form>
          );
        })}

        {modalTransitions.map((transition) => {
          const Icon = ICONS[transition.to];
          return (
            <Button
              key={transition.to}
              type="button"
              variant={transition.destructive ? "destructive" : "outline"}
              className="w-full sm:w-auto"
              onClick={() => {
                setModal(transition);
                setNote("");
                setNoteError(null);
              }}
            >
              <Icon className="size-4" aria-hidden />
              {LABELS[transition.to]}
            </Button>
          );
        })}
      </div>

      {modal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transition-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        >
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="transition-title" className="text-base font-semibold">
                  {LABELS[modal.to]}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{taskTitle}</p>
              </div>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form
              action={formAction}
              className="mt-4 space-y-3"
              onSubmit={async (event) => {
                if (navigator.onLine) return;
                event.preventDefault();
                await queueOffline(modal, note);
              }}
            >
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="to" value={modal.to} />
              <label htmlFor="transition-note" className="block text-sm font-medium">
                {modal.requiresNote ? "Reason (required)" : "Reason (optional)"}
              </label>
              <Textarea
                id="transition-note"
                name="note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(null);
                }}
                rows={3}
                placeholder={
                  modal.to === "rejected"
                    ? "Why can't you take this task?"
                    : modal.to === "on_hold"
                      ? "What is blocking progress?"
                      : "Add a short note for the timeline"
                }
                autoFocus
              />
              {noteError ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {noteError}
                </p>
              ) : null}
              {modal.destructive ? (
                <p className="text-sm text-muted-foreground">
                  This stops the task and notifies the assigned tasker.
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <SubmitButton
                  variant={modal.destructive ? "destructive" : "default"}
                  pendingLabel="Updating…"
                >
                  Confirm
                  <ChevronRight className="size-4" aria-hidden />
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ActionSpinner() {
  return <Loader2 className={cn("size-4 animate-spin")} aria-hidden />;
}
