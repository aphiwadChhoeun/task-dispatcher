"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { acceptInviteAction, type AuthFormState } from "@/features/auth/actions";

const initialState: AuthFormState = {};

export function InviteForm({
  token,
  email,
  defaultName,
  existingAccount,
}: {
  token: string;
  email: string;
  defaultName: string;
  existingAccount: boolean;
}) {
  const [state, formAction] = useActionState(acceptInviteAction, initialState);

  if (state.successMessage) {
    return (
      <div className="space-y-4">
        <Alert variant="success">{state.successMessage}</Alert>
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          Go to sign in
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" value={email} readOnly disabled />
      </Field>

      {existingAccount ? (
        <>
          <Alert variant="info">
            You already have a Task Dispatcher account. Accepting adds this organization to your
            existing account; your password stays the same.
          </Alert>
          <SubmitButton className="w-full" pendingLabel="Joining…">
            <ShieldCheck className="size-4" aria-hidden />
            Accept invitation
          </SubmitButton>
        </>
      ) : (
        <>
          <Field label="Your name" htmlFor="invite-name" error={state.fieldErrors?.name} required>
            <Input
              id="invite-name"
              name="name"
              autoComplete="name"
              defaultValue={defaultName}
              required
              minLength={2}
            />
          </Field>

          <Field
            label="Choose a password"
            htmlFor="invite-password"
            hint="At least 10 characters."
            error={state.fieldErrors?.password}
            required
          >
            <Input
              id="invite-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="invite-confirm"
            error={state.fieldErrors?.confirmPassword}
            required
          >
            <Input
              id="invite-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Field>

          <SubmitButton className="w-full" pendingLabel="Activating…">
            <ShieldCheck className="size-4" aria-hidden />
            Activate account
          </SubmitButton>
        </>
      )}
    </form>
  );
}
