import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GrievanceForm } from "@/features/grievances/components/grievance-form";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTaskerTasksForGrievance } from "@/features/grievances/queries";
import { getTaskById } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "File a grievance" };
export const dynamic = "force-dynamic";

export default async function TaskGrievancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireTasker();
  const { id } = await params;
  const db = getDb();
  const task = await getTaskById(db, user.orgId, id);
  if (!task || task.taskerId !== user.id) notFound();
  const tasks = await listTaskerTasksForGrievance(db, user.orgId, user.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="File a grievance"
        description={task.title}
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>What went wrong?</CardTitle>
        </CardHeader>
        <CardContent>
          <GrievanceForm tasks={tasks} defaultTaskId={task.id} />
        </CardContent>
      </Card>
    </div>
  );
}
