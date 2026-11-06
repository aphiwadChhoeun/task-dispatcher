import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { DispatcherBottomNav, DispatcherSideNav } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requireDispatcher } from "@/features/auth/session";
import { OrganizationLogo } from "@/features/organizations/components/organization-logo";
import { organizationThemeStyle } from "@/features/organizations/theme";
import { initials } from "@/lib/utils";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DispatcherLayout({ children }: { children: ReactNode }) {
  const { user, organization } = await requireDispatcher();

  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[268px_minmax(0,1fr)]"
      style={organizationThemeStyle(organization)}
    >
      <aside className="sidebar-surface hidden h-dvh flex-col border-r border-sidebar-border p-4 text-sidebar-foreground lg:sticky lg:top-0 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2 pt-1">
          <OrganizationLogo organization={organization} className="size-10 rounded-xl" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">
                {config.app.name}
              </span>
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            </span>
            <span className="block truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
              {organization.name}
            </span>
          </span>
        </Link>
        <DispatcherSideNav />
        <div className="mt-auto space-y-3 border-t border-sidebar-border pt-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.045] p-2.5 ring-1 ring-inset ring-white/[0.04]">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-sidebar-foreground ring-1 ring-white/10">
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block text-[10.5px] uppercase tracking-[0.12em] text-sidebar-muted">
                {user.role}
              </span>
            </span>
          </div>
          <SignOutButton className="w-full justify-start text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 nav-glass px-4 lg:hidden">
          <Link href="/dashboard" className="flex min-h-11 min-w-0 items-center gap-2.5">
            <OrganizationLogo
              organization={organization}
              className="size-9 rounded-xl"
              iconClassName="size-4"
            />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.02em]">
                {config.app.name}
              </span>
              <span className="block truncate text-[10.5px] text-muted-foreground">
                {organization.name}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
              {initials(user.name)}
            </span>
            <SignOutButton compact />
          </div>
        </header>

        <main
          id="main"
          className="page-enter mx-auto w-full max-w-7xl px-4 pb-mobile-nav pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <DispatcherBottomNav />
    </div>
  );
}
