import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { GrievanceCard } from "@/features/grievances/components/grievance-card";
import { requireTasker } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listGrievances } from "@/features/grievances/queries";

export const metadata: Metadata = { title: "My grievances" };
export const dynamic = "force-dynamic";

export default async function MyGrievancesPage() {
  const { user } = await requireTasker();
  const rows = await listGrievances(getDb(), user.orgId, {}, { taskerId: user.id });

  return (
    <div className="space-y-4">
      <PageHeader
        title="My grievances"
        description="Track what you filed and any dispatcher response."
        actions={
          rows.length > 0 ? (
            <Link href="/my-grievances/new" className={buttonVariants({ size: "sm" })}>
              File a grievance
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No grievances"
          description="If something goes wrong on a task, file a grievance and dispatch will follow up."
          icon={<ShieldAlert className="size-8" aria-hidden />}
          action={
            <Link href="/my-grievances/new" className={buttonVariants({ size: "sm" })}>
              File a grievance
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GrievanceCard key={row.grievance.id} row={row} href={`/my-grievances/${row.grievance.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
