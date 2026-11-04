import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { GrievanceForm } from "@/features/grievances/components/grievance-form";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTaskerTasksForGrievance } from "@/features/grievances/queries";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "File a grievance" };
export const dynamic = "force-dynamic";

export default async function NewGrievancePage() {
  const { user } = await requireTasker();
  const tasks = await listTaskerTasksForGrievance(getDb(), user.orgId, user.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="File a grievance"
        description="Tell dispatch what happened. You will be able to see their response here."
      />
      <Card>
        <CardContent className="p-4">
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks to attach"
              description="A grievance must be linked to one of your tasks."
            />
          ) : (
            <GrievanceForm tasks={tasks} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
