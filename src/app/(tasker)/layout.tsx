import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { TaskerNav } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { NotificationPermission } from "@/components/pwa/notification-permission";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { requireTasker } from "@/features/auth/session";
import { config } from "@/config";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TaskerLayout({ children }: { children: ReactNode }) {
  const { user } = await requireTasker();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/70 nav-glass">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-2 px-4">
          <Link href="/my-tasks" className="flex min-w-0 items-center gap-2.5">
            <span className="brand-mark flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
              <MapPinned className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.02em]">
                {config.app.name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Hi, {user.name.split(" ")[0]}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
              {initials(user.name)}
            </span>
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="space-y-2.5">
          <InstallPrompt />
          <NotificationPermission />
        </div>
      </div>

      <main id="main" className="page-enter mx-auto w-full max-w-2xl px-4 pb-mobile-nav pt-5">
        {children}
      </main>

      <TaskerNav />
      <OfflineSync />
    </div>
  );
}
