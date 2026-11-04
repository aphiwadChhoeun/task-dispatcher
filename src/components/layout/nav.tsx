"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Map,
  Megaphone,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/messages";

const dispatcherItems = [
  { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
  { href: "/tasks", label: t("nav.tasks"), icon: ClipboardList },
  { href: "/live", label: t("nav.live"), icon: Map },
  { href: "/taskers", label: t("nav.taskers"), icon: Users },
  { href: "/grievances", label: t("nav.grievances"), icon: ShieldAlert },
  { href: "/announcements", label: "Broadcasts", icon: Megaphone },
];

const taskerItems = [
  { href: "/my-tasks", label: t("nav.myTasks"), icon: ClipboardList },
  { href: "/my-grievances", label: t("nav.myGrievances"), icon: ShieldAlert },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DispatcherSideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="space-y-1">
      {dispatcherItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
              active
                ? "bg-white/[0.075] text-sidebar-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
                : "text-sidebar-muted hover:bg-white/[0.045] hover:text-sidebar-foreground",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-primary/25 text-[#9fe3ce]"
                  : "text-sidebar-muted group-hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DispatcherBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-2 bottom-2 z-40 overflow-hidden rounded-2xl border border-border/80 nav-glass shadow-[0_18px_40px_-16px_rgb(18_26_22/0.35)] lg:hidden safe-bottom"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {dispatcherItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[9.5px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-[2px] w-5 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <Icon className={cn("size-[18px]", active && "stroke-[2.4]")} aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TaskerNav({ orientation = "bottom" }: { orientation?: "bottom" | "top" }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className={cn(
        orientation === "bottom" &&
          "fixed bottom-2 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xs -translate-x-1/2 overflow-hidden rounded-2xl border border-border/80 nav-glass shadow-[0_18px_40px_-16px_rgb(18_26_22/0.35)] safe-bottom",
        orientation === "top" && "flex gap-1",
      )}
    >
      <div
        className={cn(
          orientation === "bottom" && "mx-auto grid w-full grid-cols-2",
          orientation === "top" && "flex gap-1",
        )}
      >
        {taskerItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-4 text-[10.5px] font-medium transition-colors",
                orientation === "top" && "min-h-10 flex-row gap-1.5 rounded-lg px-3 text-sm",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {orientation === "bottom" ? (
                <span
                  className={cn(
                    "absolute top-0 h-[2px] w-6 rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn("size-5", orientation === "top" && "size-4", active && "stroke-[2.4]")}
                aria-hidden
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
