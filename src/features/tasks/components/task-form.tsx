"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { LocationPicker } from "@/features/maps/components/location-picker";
import type { TaskFormState } from "@/features/tasks/form-state";
import { toDateTimeLocal } from "@/lib/format";

export type TaskerOption = { id: string; name: string; status: string };

export type TaskInitial = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  scheduledStart: string;
  scheduledEnd: string;
  taskerId: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  lat: number | null;
  lng: number | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  instructions: string | null;
};

type Props = {
  action: (state: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  taskers: TaskerOption[];
  initial?: TaskInitial;
  defaultStartIso: string;
  defaultEndIso: string;
  cancelHref: string;
};

export function TaskForm({ action, taskers, initial, defaultStartIso, defaultEndIso, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, {} as TaskFormState);
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  useEffect(() => {
    setScheduledStart(toDateTimeLocal(initial?.scheduledStart ?? defaultStartIso));
    setScheduledEnd(toDateTimeLocal(initial?.scheduledEnd ?? defaultEndIso));
  }, [initial?.scheduledStart, initial?.scheduledEnd, defaultStartIso, defaultEndIso]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {initial ? <input type="hidden" name="taskId" value={initial.id} /> : null}
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Task details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title" htmlFor="title" error={errors.title} required>
            <Input
              id="title"
              name="title"
              defaultValue={initial?.title ?? ""}
              placeholder="e.g. Deliver replacement pump"
              maxLength={140}
              required
              aria-invalid={Boolean(errors.title)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" error={errors.type} required>
              <Select id="type" name="type" defaultValue={initial?.type ?? "service"}>
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
                <option value="inspection">Inspection</option>
                <option value="repair">Repair</option>
                <option value="service">Service</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Priority" htmlFor="priority" error={errors.priority} required>
              <Select id="priority" name="priority" defaultValue={initial?.priority ?? "normal"}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Window starts"
              htmlFor="scheduledStart"
              error={errors.scheduledStart}
              required
            >
              <Input
                id="scheduledStart"
                name="scheduledStart"
                type="datetime-local"
                value={scheduledStart}
                onChange={(event) => setScheduledStart(event.target.value)}
                required
              />
            </Field>
            <Field label="Window ends" htmlFor="scheduledEnd" error={errors.scheduledEnd} required>
              <Input
                id="scheduledEnd"
                name="scheduledEnd"
                type="datetime-local"
                value={scheduledEnd}
                onChange={(event) => setScheduledEnd(event.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Assign to tasker" htmlFor="taskerId" error={errors.taskerId} required>
            <Select id="taskerId" name="taskerId" defaultValue={initial?.taskerId ?? ""} required>
              <option value="">Choose a tasker…</option>
              {taskers.map((tasker) => (
                <option key={tasker.id} value={tasker.id}>
                  {tasker.name}
                  {tasker.status !== "active" ? ` (${tasker.status})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Description" htmlFor="description" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
              placeholder="What needs to be done?"
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationPicker
            initialLat={initial?.lat ?? null}
            initialLng={initial?.lng ?? null}
            initialAddress={{
              addressStreet: initial?.addressStreet ?? "",
              addressCity: initial?.addressCity ?? "",
              addressState: initial?.addressState ?? "",
              addressPostalCode: initial?.addressPostalCode ?? "",
              addressCountry: initial?.addressCountry ?? "US",
            }}
            errors={errors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer & instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
              <Input
                id="customerName"
                name="customerName"
                defaultValue={initial?.customerName ?? ""}
                autoComplete="name"
              />
            </Field>
            <Field label="Customer phone" htmlFor="customerPhone" error={errors.customerPhone}>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                defaultValue={initial?.customerPhone ?? ""}
                autoComplete="tel"
              />
            </Field>
          </div>
          <Field
            label="Instructions for the tasker"
            htmlFor="instructions"
            error={errors.instructions}
          >
            <Textarea
              id="instructions"
              name="instructions"
              defaultValue={initial?.instructions ?? ""}
              rows={3}
              placeholder="Access codes, safety notes, who to ask for…"
            />
          </Field>
          <Field label="Internal notes" htmlFor="notes" error={errors.notes}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={2}
              placeholder="Only visible to dispatch"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted"
        >
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving task…">
          <Save className="size-4" aria-hidden />
          {initial ? "Save task" : "Create task"}
        </SubmitButton>
      </div>
    </form>
  );
}
