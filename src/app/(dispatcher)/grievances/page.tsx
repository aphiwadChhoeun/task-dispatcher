import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { GrievanceCard } from "@/features/grievances/components/grievance-card";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import {
  listGrievances,
  listTaskerOptionsForGrievanceFilter,
} from "@/features/grievances/queries";
import { grievanceFiltersSchema } from "@/features/grievances/schemas";

export const metadata: Metadata = { title: "Grievances" };
export const dynamic = "force-dynamic";

export default async function GrievancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireDispatcher();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = grievanceFiltersSchema.safeParse({
    status: first(params.status) || undefined,
    severity: first(params.severity) || undefined,
    category: first(params.category) || undefined,
    q: first(params.q) || undefined,
    taskerId: first(params.taskerId) || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const db = getDb();
  const [rows, taskers] = await Promise.all([
    listGrievances(db, user.orgId, filters),
    listTaskerOptionsForGrievanceFilter(db, user.orgId),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Grievances"
        description={`${rows.length} grievance${rows.length === 1 ? "" : "s"} in this view`}
      />

      <form method="get" className="grid gap-2.5 rounded-2xl border border-border/85 bg-card p-3.5 shadow-card sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="g-q" className="sr-only">Search</label>
          <Input id="g-q" name="q" defaultValue={filters.q ?? ""} placeholder="Search description or task…" />
        </div>
        <Select name="status" defaultValue={filters.status ?? "all"} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="open_queue">Open queue</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select name="severity" defaultValue={filters.severity ?? ""} aria-label="Severity">
          <option value="">Any severity</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
        <Select name="category" defaultValue={filters.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          <option value="wrong_address">Wrong address</option>
          <option value="unsafe_site">Unsafe site</option>
          <option value="unfair_assignment">Unfair assignment</option>
          <option value="payment_issue">Payment issue</option>
          <option value="customer_conduct">Customer conduct</option>
          <option value="other">Other</option>
        </Select>
        <Select name="taskerId" defaultValue={filters.taskerId ?? ""} aria-label="Tasker">
          <option value="">All taskers</option>
          {taskers.map((tasker) => (
            <option key={tasker.id} value={tasker.id}>{tasker.name}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm">Apply filters</Button>
          <Link href="/grievances" className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No grievances in this view"
          description="Grievances filed by taskers will appear here."
          icon={<ShieldAlert className="size-8" aria-hidden />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <GrievanceCard key={row.grievance.id} row={row} href={`/grievances/${row.grievance.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
