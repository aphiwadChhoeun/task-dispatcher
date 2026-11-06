import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, MapPinned } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { selectOrganizationAction } from "@/features/auth/organization-actions";
import { OrganizationLogo } from "@/features/organizations/components/organization-logo";
import {
  findUserById,
  listActiveMembershipsForUser,
} from "@/features/auth/queries";
import {
  getOrgSelectChallengeUserId,
  getSession,
} from "@/features/auth/session";
import { formatRelative } from "@/lib/format";
import { config } from "@/config";

export const metadata: Metadata = {
  title: "Choose organization",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SelectOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const userId = session?.user.id ?? (await getOrgSelectChallengeUserId());
  if (!userId) redirect("/login?reason=session");

  const [user, memberships, params] = await Promise.all([
    findUserById(userId),
    listActiveMembershipsForUser(userId),
    searchParams,
  ]);
  if (!user) redirect("/login?reason=session");
  if (memberships.length === 0) redirect("/login?reason=session");

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <div className="brand-mark mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
            <MapPinned className="size-6" aria-hidden />
          </div>
          <p className="section-label mb-2 justify-center">{config.app.name}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Choose an organization</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {session
              ? `You are signed in as ${user.email}. Switch the workspace you are viewing.`
              : `Your account belongs to more than one organization. Pick one to continue as ${user.email}.`}
          </p>
        </div>

        {params.error === "unavailable" ? (
          <Alert variant="warning">
            That organization is no longer available. Choose another workspace.
          </Alert>
        ) : null}

        <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-4 shadow-lift sm:p-5">
          {memberships.map(({ membership, organization }) => {
            const current = session?.membership.id === membership.id;
            return (
              <div
                key={membership.id}
                className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <OrganizationLogo
                    organization={organization}
                    className="size-10 rounded-xl"
                    iconClassName="size-4"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{organization.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <Badge variant={membership.role === "tasker" ? "muted" : "success"}>
                        {membership.role}
                      </Badge>
                      <span>Member since {formatRelative(membership.createdAt)}</span>
                    </p>
                  </div>
                </div>

                {current ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Current
                  </span>
                ) : (
                  <form action={selectOrganizationAction} className="shrink-0">
                    <input type="hidden" name="membershipId" value={membership.id} />
                    <Button type="submit" size="sm" className="w-full sm:w-auto">
                      Open workspace
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          {session ? <SignOutButton compact={false} /> : null}
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
            Use a different account
          </Link>
        </div>
      </div>
    </main>
  );
}
