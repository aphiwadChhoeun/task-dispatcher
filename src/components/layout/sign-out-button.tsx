"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { clearOfflineQueue } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        try {
          navigator.serviceWorker?.controller?.postMessage({ type: "clear" });
        } catch {
          // service worker not available
        }
        void clearOfflineQueue();
      }}
    >
      <button
        type="submit"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          compact && "min-h-11 size-11 justify-center px-0",
          className,
        )}
      >
        <LogOut className="size-4" aria-hidden />
        {compact ? <span className="sr-only">Sign out</span> : "Sign out"}
      </button>
    </form>
  );
}
