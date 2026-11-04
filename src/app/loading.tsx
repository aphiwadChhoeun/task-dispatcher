import { Spinner } from "@/components/ui/page-header";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner />
      Loading…
    </div>
  );
}
