import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { TaskerFilters } from "@/features/taskers/schemas";

export function TaskerFiltersBar({
  filters,
  className,
}: {
  filters: TaskerFilters;
  className?: string;
}) {
  return (
    <form
      method="get"
      action="/taskers"
      className={className}
      role="search"
    >
      <div className="grid gap-2.5 rounded-2xl border border-border/85 bg-card p-3.5 shadow-card sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="tasker-q" className="sr-only">
            Search taskers
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="tasker-q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Search name, email, phone, skills…"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <label htmlFor="tasker-status" className="sr-only">
            Status
          </label>
          <Select id="tasker-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="deactivated">Deactivated</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Search
          </Button>
          {filters.q || filters.status ? (
            <Link
              href="/taskers"
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
