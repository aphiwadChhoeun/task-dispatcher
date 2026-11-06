import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TaskerForm } from "@/features/taskers/components/tasker-form";
import { TaskerFiltersBar } from "@/features/taskers/components/tasker-filters";
import { ResendInviteForm, TaskerStatusForm } from "@/features/taskers/components/tasker-status-form";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { listTaskers } from "@/features/tasks/queries";
import { taskerFiltersFromSearchParams } from "@/features/taskers/schemas";
import { formatRelative } from "@/lib/format";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Taskers" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  active: "success",
  invited: "warning",
  deactivated: "muted",
} as const;

export default async function TaskersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireDispatcher();
  const params = await searchParams;
  const filters = taskerFiltersFromSearchParams(params);
  const hasFilters = Boolean(filters.q || filters.status);
  const taskers = await listTaskers(getDb(), user.orgId, filters);
  const active = taskers.filter((tasker) => tasker.status === "active").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Taskers"
        description={`${active} active · ${taskers.length} ${hasFilters ? "matching" : "total"}`}
      />

      <TaskerFiltersBar filters={filters} />

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
              <Plus className="size-3.5" aria-hidden />
            </span>
            Invite a tasker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskerForm />
        </CardContent>
      </Card>

      {taskers.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" aria-hidden />}
          title="No taskers match this search"
          description="Try a different name, email, phone number, or clear the filters."
          action={
            <Link href="/taskers" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Clear search
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {taskers.map((tasker) => (
            <Card
              key={tasker.id}
              className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lift"
            >
              <CardContent className="space-y-3.5 p-4 sm:p-6 sm:pt-6">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-black/10"
                    style={{ background: tasker.color }}
                    aria-hidden
                  >
                    {initials(tasker.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/taskers/${tasker.id}`}
                      className="block truncate text-[14.5px] font-semibold tracking-[-0.01em] hover:underline"
                    >
                      {tasker.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{tasker.email}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[tasker.status as keyof typeof STATUS_VARIANT] ?? "muted"} className="capitalize">
                    {tasker.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5 opacity-80" aria-hidden />
                    {tasker.activeTasks} active
                  </span>
                  {tasker.phone ? (
                    <a className="inline-flex items-center gap-1 hover:text-foreground" href={`tel:${tasker.phone}`}>
                      <Phone className="size-3.5 opacity-80" aria-hidden />
                      {tasker.phone}
                    </a>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5 opacity-80" aria-hidden />
                    {formatRelative(tasker.createdAt)}
                  </span>
                </div>

                {tasker.vehicle || tasker.skills ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {[tasker.vehicle, tasker.skills ? parseSkills(tasker.skills) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}

                <div className="space-y-2 border-t border-border/80 pt-3">
                  <Link
                    href={`/taskers/${tasker.id}`}
                    className={buttonVariants({ size: "sm", variant: "outline", className: "w-full" })}
                  >
                    View profile
                  </Link>
                  <TaskerStatusForm taskerId={tasker.id} status={tasker.status} />
                  {tasker.status === "invited" ? <ResendInviteForm taskerId={tasker.id} /> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function parseSkills(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.join(", ") : raw;
  } catch {
    return raw;
  }
}
