"use client";

import { useActionState } from "react";
import { Megaphone, Send } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createAnnouncementAction,
  type AnnouncementFormState,
} from "@/features/announcements/actions";

export function AnnouncementForm({
  taskers,
}: {
  taskers: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(createAnnouncementAction, {} as AnnouncementFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <label htmlFor="announcement-body" className="mb-1.5 block text-sm font-medium">
          Message to taskers
        </label>
        <Textarea
          id="announcement-body"
          name="body"
          rows={4}
          required
          maxLength={2000}
          placeholder="Weather warning, schedule change, safety reminder…"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Recipients</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {taskers.map((tasker) => (
            <label
              key={tasker.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary/30 has-[:checked]:bg-primary/[0.055]"
            >
              <input
                type="checkbox"
                name="recipientIds"
                value={tasker.id}
                defaultChecked
                className="size-4 accent-[#0d5f4c]"
              />
              {tasker.name}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Sending…">
        <Send className="size-4" aria-hidden />
        Send announcement
      </SubmitButton>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Megaphone className="size-3.5" aria-hidden />
        Taskers see announcements on their My Tasks page and receive an in-app notification.
      </p>
    </form>
  );
}
