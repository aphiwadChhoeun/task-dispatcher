import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, MapPinned } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { InviteForm } from "@/features/auth/components/invite-form";
import { findInvitation } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Accept invitation",
  description: "Accept your invitation and set a password to activate your Task Dispatcher tasker account.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await findInvitation(token);

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="brand-mark mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
            <MapPinned className="size-6" aria-hidden />
          </div>
          <p className="section-label mb-2 justify-center">You are invited</p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            {invitation ? `Join ${invitation.organizationName}` : "Accept your invitation"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {invitation
              ? invitation.user.passwordHash
                ? `Add ${invitation.organizationName} to your existing Task Dispatcher account.`
                : `Set a password to create your tasker account for ${invitation.organizationName} on Task Dispatcher.`
              : "Set a password to activate your tasker account."}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-lift sm:p-7">
          {invitation ? (
            <InviteForm
              token={token}
              email={invitation.user.email}
              defaultName={invitation.user.name}
              existingAccount={Boolean(invitation.user.passwordHash)}
            />
          ) : (
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto size-10 text-destructive" aria-hidden />
              <Alert variant="error">
                This invitation is invalid, has already been used, or has expired.
              </Alert>
              <p className="text-sm text-muted-foreground">
                Ask your dispatcher to send a new invite link.
              </p>
              <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
