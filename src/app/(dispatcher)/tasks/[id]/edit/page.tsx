import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { updateTaskAction } from "@/features/tasks/actions";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { getTaskById, listTaskerOptions } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "Edit task" };
export const dynamic = "force-dynamic";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireDispatcher();
  const { id } = await params;
  const db = getDb();
  const [task, taskers] = await Promise.all([
    getTaskById(db, user.orgId, id),
    listTaskerOptions(db, user.orgId),
  ]);
  if (!task) notFound();

  const fallbackEnd = new Date(
    (task.scheduledStart ?? task.createdAt).getTime() + 2 * 60 * 60 * 1000,
  );
  const defaultStartIso = (task.scheduledStart ?? task.createdAt).toISOString();
  const defaultEndIso = (task.scheduledEnd ?? fallbackEnd).toISOString();

  return (
    <div className="space-y-4">
      <PageHeader title="Edit task" description={task.title} />
      <TaskForm
        action={updateTaskAction}
        taskers={taskers}
        initial={{
          id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          scheduledStart: defaultStartIso,
          scheduledEnd: defaultEndIso,
          taskerId: task.taskerId,
          addressStreet: task.addressStreet,
          addressCity: task.addressCity,
          addressState: task.addressState,
          addressPostalCode: task.addressPostalCode,
          addressCountry: task.addressCountry,
          lat: task.lat,
          lng: task.lng,
          customerName: task.customerName,
          customerPhone: task.customerPhone,
          notes: task.notes,
          instructions: task.instructions,
        }}
        defaultStartIso={defaultStartIso}
        defaultEndIso={defaultEndIso}
        cancelHref={`/tasks/${task.id}`}
      />
    </div>
  );
}
