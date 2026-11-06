import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CheckCircle2, MapPin, MapPinned, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSession, homeForRole } from "@/features/auth/session";
import { config } from "@/config";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Task Dispatcher — field service dispatch software for assigning tasks, tracking taskers live, and capturing proof of work.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in · Task Dispatcher",
    description:
      "Field service dispatch software: assign tasks, track taskers live with GPS, and capture proof of work.",
    url: "/login",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

const DEMO_ACCOUNTS = [
  { role: "Dispatcher", email: "dispatch@example.com", password: "Password123!" },
  { role: "Tasker", email: "alex@example.com", password: "Password123!" },
  { role: "Tasker", email: "maria@example.com", password: "Password123!" },
  { role: "Tasker", email: "sam@example.com", password: "Password123!" },
];

const HIGHLIGHTS = [
  { icon: Activity, title: "Live field visibility", copy: "See every task and tasker as the day moves." },
  { icon: MapPin, title: "Turn-by-turn context", copy: "Addresses, routes, and location in one view." },
  { icon: ShieldCheck, title: "Proof, not guesswork", copy: "Photos, notes, and a full activity trail." },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeForRole(session.user.role));

  const params = await searchParams;
  const next = params.next;
  const showDemo = process.env.NODE_ENV !== "production";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Task Dispatcher",
        url: config.app.origin,
        logo: `${config.app.origin}/icons/icon-512.png`,
      },
      {
        "@type": "SoftwareApplication",
        name: "Task Dispatcher",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android (PWA)",
        description:
          "Mobile-first field service dispatch app: assign tasks, track taskers live with GPS, capture proof of work with photos, and manage grievances.",
        url: config.app.origin,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Field task dispatch and assignment",
          "Live GPS location tracking of taskers",
          "Photo proof of work with compression",
          "Offline-capable tasker PWA with queued sync",
          "Per-task messaging and broadcasts",
          "Grievance filing and audit trail",
        ],
      },
      {
        "@type": "WebSite",
        name: "Task Dispatcher",
        url: config.app.origin,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
            Built for teams in the field
          </span>
          <p className="mt-6 text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.035em] text-sidebar-foreground xl:text-[3rem]">
            Every task. Every stop.
            <br />
            <span className="text-[#9fe3ce]">Under control.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-sidebar-muted">
            Dispatch work, follow your team live, and close the loop with proof of work — without
            the paperwork.
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
            Works offline. Syncs when you reconnect.
          </span>
          <span className="uppercase tracking-[0.16em]">v1.0</span>
        </div>
      </aside>

      <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-mark flex size-10 items-center justify-center rounded-xl text-primary-foreground">
              <MapPinned className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em]">{config.app.name}</p>
              <p className="text-[11px] text-muted-foreground">Dispatch field work with clarity.</p>
            </div>
          </div>

          <div className="mt-7 lg:mt-0">
            <p className="section-label mb-3 lg:hidden">Welcome back</p>
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.03em] lg:text-[1.9rem]">
              Sign in to continue
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use the account your dispatcher set up for you.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-border/80 bg-card p-5 shadow-lift sm:p-7">
            {params.reason === "session" ? (
              <Alert className="mb-4" variant="warning">
                Your session expired. Please sign in again.
              </Alert>
            ) : null}
            <LoginForm next={next} />
            <p className="mt-4 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
              New organization?{" "}
              <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
                Create a workspace
              </Link>
            </p>
          </div>

          {showDemo ? (
            <div className="mt-5 rounded-2xl border border-dashed border-border/90 bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Demo accounts
                </p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Local only
                </span>
              </div>
              <ul className="divide-y divide-border/70">
                {DEMO_ACCOUNTS.map((account) => (
                  <li
                    key={account.email}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-[12px] font-medium text-foreground">{account.email}</span>
                    <span className="text-[10.5px] text-muted-foreground">{account.role}</span>
                    <code className="ml-auto rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {account.password}
                    </code>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground/80">
                Seeded by <code className="font-mono">npm run db:reset</code>. Not shown in production.
              </p>
            </div>
          ) : null}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Taskers join by invitation from their dispatcher.
          </p>
        </div>
      </section>
    </main>
    </>
  );
}
