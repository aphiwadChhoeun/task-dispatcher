import Link from "next/link";
import { CloudOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Offline",
  description: "You are offline. Cached tasks remain available and changes sync when reconnected.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-card text-muted-foreground shadow-card">
        <CloudOff className="size-7" aria-hidden />
      </span>
      <p className="section-label mb-2">No connection</p>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Cached tasks are still available from My Tasks. Status updates and photos will sync
        automatically when your connection returns.
      </p>
      <Link href="/my-tasks" className={buttonVariants({ className: "mt-6" })}>
        Open cached tasks
      </Link>
    </main>
  );
}
