import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, MapPinned, ShieldCheck, Users } from "lucide-react";
import { SignupForm } from "@/features/auth/components/signup-form";
import { getSession, homeForRole } from "@/features/auth/session";
import { config } from "@/config";

export const metadata: Metadata = {
  title: "Create your organization",
  description:
    "Create a Task Dispatcher organization, invite your field team, and start dispatching work in minutes.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/signup" },
};

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  {
    icon: Building2,
    title: "One workspace per organization",
    copy: "Tasks, taskers, messages, and locations stay isolated to your team.",
  },
  {
    icon: Users,
    title: "Invite your field team",
    copy: "Send one-time invite links so taskers can create their own accounts.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    copy: "Role-based access, HTTP-only sessions, and an organization-scoped audit trail.",
  },
];

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.user.role));

  return (
    <main id="main" className="min-h-dvh lg:grid lg:grid-cols-[1.02fr_1fr]">
      <aside className="sidebar-surface relative hidden overflow-hidden p-10 text-sidebar-foreground lg:flex lg:flex-col xl:p-14">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -right-40 top-1/4 size-[30rem] rounded-full border border-white/[0.06]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/4 size-[22rem] rounded-full border border-white/[0.05]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(60%_100%_at_20%_100%,rgb(185_129_50/0.16),transparent_70%)]"
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="brand-mark flex size-11 items-center justify-center rounded-2xl text-primary-foreground">
            <MapPinned className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">{config.app.name}</p>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
              Field operations
            </p>
          </div>
        </div>

        <div className="relative my-auto max-w-lg py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-sidebar-muted">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Set up your dispatch workspace
          </span>
          <p className="mt-6 text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.035em] text-sidebar-foreground xl:text-[3rem]">
            Your team.
            <br />
            <span className="text-[#9fe3ce]">Your workspace.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-sidebar-muted">
            Create an organization for your field operation, then invite the taskers who will
            carry the work.
          </p>

          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.055] text-[#9fe3ce]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-sidebar-foreground">
                      {item.title}
                    </span>
                    <span className="block text-[12.5px] leading-relaxed text-sidebar-muted">
                      {item.copy}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-sidebar-border pt-5 text-[11px] text-sidebar-muted">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-[#9fe3ce]" aria-hidden />
            Free to start. No credit card required.
          </span>
          <span className="uppercase tracking-[0.16em]">v1.0</span>
        </div>
      </aside>

      <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[470px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-mark flex size-10 items-center justify-center rounded-xl text-primary-foreground">
              <MapPinned className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em]">{config.app.name}</p>
              <p className="text-[11px] text-muted-foreground">Create your team workspace.</p>
            </div>
          </div>

          <div>
            <p className="section-label mb-3">Get started</p>
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.03em]">
              Create your organization
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Set up a workspace and the first dispatcher account. You can invite taskers right
              after.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-border/80 bg-card p-5 shadow-lift sm:p-7">
            <SignupForm />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
