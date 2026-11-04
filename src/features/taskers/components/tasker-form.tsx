"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTaskerAction, type TaskerFormState } from "@/features/taskers/actions";
import { InviteLink } from "@/features/taskers/components/invite-link";

export function TaskerForm() {
  const [state, formAction] = useActionState(createTaskerAction, {} as TaskerFormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="tasker-name" required>
          <Input id="tasker-name" name="name" autoComplete="name" required minLength={2} />
        </Field>
        <Field label="Email" htmlFor="tasker-email" required>
          <Input id="tasker-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Phone" htmlFor="tasker-phone">
          <Input id="tasker-phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="Map color" htmlFor="tasker-color" hint="Used for their marker on the live map.">
          <Input id="tasker-color" name="color" type="color" defaultValue="#0f766e" className="color-swatch w-16 shrink-0 p-1" />
        </Field>
        <Field label="Skills" htmlFor="tasker-skills" hint="Comma separated." className="sm:col-span-2">
          <Input id="tasker-skills" name="skills" placeholder="Plumbing, Delivery, Inspection" />
        </Field>
        <Field label="Vehicle" htmlFor="tasker-vehicle">
          <Input id="tasker-vehicle" name="vehicle" placeholder="Cargo van" />
        </Field>
        <Field label="Availability" htmlFor="tasker-availability">
          <Input id="tasker-availability" name="availability" placeholder="Mon–Fri 8am–6pm" />
        </Field>
      </div>

      <SubmitButton pendingLabel="Creating invite…">
        <UserPlus className="size-4" aria-hidden />
        Create & invite tasker
      </SubmitButton>
    </form>
  );
}
