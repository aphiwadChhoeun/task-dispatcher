"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateTaskerAction, type TaskerFormState } from "@/features/taskers/actions";

export function TaskerEditForm({
  tasker,
}: {
  tasker: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    skills: string | null;
    vehicle: string | null;
    availability: string | null;
    color: string;
  };
}) {
  const [state, formAction] = useActionState(updateTaskerAction, {} as TaskerFormState);
  const skills = (() => {
    if (!tasker.skills) return "";
    try {
      const parsed = JSON.parse(tasker.skills) as unknown;
      return Array.isArray(parsed) ? parsed.join(", ") : tasker.skills;
    } catch {
      return tasker.skills;
    }
  })();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="taskerId" value={tasker.id} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="edit-name" required>
          <Input id="edit-name" name="name" defaultValue={tasker.name} required />
        </Field>
        <Field label="Email" htmlFor="edit-email" required>
          <Input id="edit-email" name="email" type="email" defaultValue={tasker.email} required />
        </Field>
        <Field label="Phone" htmlFor="edit-phone">
          <Input id="edit-phone" name="phone" type="tel" defaultValue={tasker.phone ?? ""} />
        </Field>
        <Field label="Map color" htmlFor="edit-color">
          <Input id="edit-color" name="color" type="color" defaultValue={tasker.color} className="color-swatch w-16 shrink-0 p-1" />
        </Field>
        <Field label="Skills" htmlFor="edit-skills" hint="Comma separated." className="sm:col-span-2">
          <Input id="edit-skills" name="skills" defaultValue={skills} />
        </Field>
        <Field label="Vehicle" htmlFor="edit-vehicle">
          <Input id="edit-vehicle" name="vehicle" defaultValue={tasker.vehicle ?? ""} />
        </Field>
        <Field label="Availability" htmlFor="edit-availability">
          <Input
            id="edit-availability"
            name="availability"
            defaultValue={tasker.availability ?? ""}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
