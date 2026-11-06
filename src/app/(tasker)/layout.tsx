import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { TaskerNav } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { NotificationPermission } from "@/components/pwa/notification-permission";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { countActiveMembershipsForUser } from "@/features/auth/queries";
import { requireTasker } from "@/features/auth/session";
import { OrganizationLogo } from "@/features/organizations/components/organization-logo";
import { organizationThemeStyle } from "@/features/organizations/theme";
import { config } from "@/config";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TaskerLayout({ children }: { children: ReactNode }) {
  const { user, organization } = await requireTasker();
  const membershipCount = await countActiveMembershipsForUser(user.id);

  return (
    <div className="min-h-dvh" style={organizationThemeStyle(organization)}>
      <header className="sticky top-0 z-30 border-b border-border/70 nav-glass">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-2 px-4">
          <Link href="/my-tasks" className="flex min-h-11 min-w-0 items-center gap-2.5">
            <OrganizationLogo
              organization={organization}
              className="size-9 rounded-xl"
              iconClassName="size-4"
            />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.02em]">
                {config.app.name}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Hi, {user.name.split(" ")[0]} · {organization.name}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            {membershipCount > 1 ? (
              <Link
                href="/select-organization"
                aria-label="Switch organization"
                title="Switch organization"
                className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Building2 className="size-4" aria-hidden />
              </Link>
            ) : null}
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
