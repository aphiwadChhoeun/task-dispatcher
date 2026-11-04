"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateGrievanceAction, type GrievanceFormState } from "@/features/grievances/actions";

export function GrievanceUpdateForm({
  grievanceId,
  status,
  assigneeId,
  resolutionNotes,
  dispatchers,
}: {
  grievanceId: string;
  status: string;
  assigneeId: string | null;
  resolutionNotes: string | null;
  dispatchers: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(updateGrievanceAction, {} as GrievanceFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="grievanceId" value={grievanceId} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <Field label="Status" htmlFor="grievance-status">
        <Select id="grievance-status" name="status" defaultValue={status}>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </Field>

      <Field label="Assigned dispatcher" htmlFor="grievance-assignee">
        <Select id="grievance-assignee" name="assigneeId" defaultValue={assigneeId ?? ""}>
          <option value="">Unassigned</option>
          {dispatchers.map((dispatcher) => (
            <option key={dispatcher.id} value={dispatcher.id}>
              {dispatcher.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Resolution notes"
        htmlFor="grievance-resolution"
        hint="Shared with the tasker when the grievance is closed."
      >
        <Textarea
          id="grievance-resolution"
          name="resolutionNotes"
          rows={4}
          defaultValue={resolutionNotes ?? ""}
          maxLength={4000}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Updating…">
        Save grievance
      </SubmitButton>
    </form>
  );
}
