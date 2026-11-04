import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/feedback";
import { TaskForm } from "@/features/tasks/components/task-form";
import { createTaskAction } from "@/features/tasks/actions";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTaskerOptions } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "New task" };
export const dynamic = "force-dynamic";

function nextSlot(hoursAhead: number): Date {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const minutes = date.getMinutes();
  date.setMinutes(minutes <= 15 ? 15 : minutes <= 30 ? 30 : minutes <= 45 ? 45 : 60, 0, 0);
  return date;
}

export default async function NewTaskPage() {
  const { user } = await requireDispatcher();
  const taskers = await listTaskerOptions(getDb(), user.orgId);
  const activeTaskers = taskers.filter((tasker) => tasker.status === "active");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create a task"
        description="Assign work, set the window, and drop a precise pin for the tasker."
      />
      {activeTaskers.length === 0 ? (
        <Alert variant="warning">Invite an active tasker before creating a task.</Alert>
      ) : null}
      <TaskForm
        action={createTaskAction}
        taskers={activeTaskers}
        defaultStartIso={nextSlot(1).toISOString()}
        defaultEndIso={nextSlot(3).toISOString()}
        cancelHref="/tasks"
      />
    </div>
  );
}
