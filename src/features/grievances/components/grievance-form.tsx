"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGrievanceAction, type GrievanceFormState } from "@/features/grievances/actions";
import { compressImage } from "@/lib/image-compress";
import { TASK_STATUS_LABELS } from "@/features/tasks/state-machine";
import type { TaskStatus } from "@/lib/db/schema";

type TaskOption = { id: string; title: string; status: string; scheduledStart: Date | string | null };

export function GrievanceForm({
  tasks,
  defaultTaskId,
}: {
  tasks: TaskOption[];
  defaultTaskId?: string;
}) {
  const [state, formAction] = useActionState(createGrievanceAction, {} as GrievanceFormState);
  const [photoCount, setPhotoCount] = useState(0);

  const compressSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, 3);
    if (files.length === 0) return;
    const compressed = await Promise.all(files.map((file) => compressImage(file, 1600, 0.82)));
    try {
      const transfer = new DataTransfer();
      for (const file of compressed) transfer.items.add(file);
      input.files = transfer.files;
      setPhotoCount(compressed.length);
    } catch {
      setPhotoCount(files.length);
    }
  };

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Task this is about" htmlFor="taskId" required>
        <Select id="taskId" name="taskId" defaultValue={defaultTaskId ?? ""} required>
          <option value="">Choose a task…</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} — {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" required>
          <Select id="category" name="category" defaultValue="wrong_address">
            <option value="wrong_address">Wrong address</option>
            <option value="unsafe_site">Unsafe site</option>
            <option value="unfair_assignment">Unfair assignment</option>
            <option value="payment_issue">Payment issue</option>
            <option value="customer_conduct">Customer conduct</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Severity" htmlFor="severity" required>
          <Select id="severity" name="severity" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </Field>
      </div>

      <Field
        label="What happened?"
        htmlFor="description"
        hint="Include what you need dispatch to know. At least 20 characters."
        required
      >
        <Textarea
          id="description"
          name="description"
          rows={5}
          minLength={20}
          maxLength={5000}
          required
          placeholder="Describe the issue, when it happened, and what you need."
        />
      </Field>

      <Field label="Photos (optional, max 3)" htmlFor="photos" hint="Photos are compressed and GPS metadata is stripped.">
        <Input
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={compressSelected}
        />
      </Field>
      {photoCount > 0 ? (
        <p className="text-xs text-muted-foreground">{photoCount} photo(s) attached</p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/my-grievances"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted"
        >
          Cancel
        </Link>
        <SubmitButton pendingLabel="Filing…">File grievance</SubmitButton>
      </div>
    </form>
  );
}
