"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInviteAction, type AuthFormState } from "@/features/auth/actions";

const initialState: AuthFormState = {};

export function InviteForm({
  token,
  email,
  defaultName,
}: {
  token: string;
  email: string;
  defaultName: string;
}) {
  const [state, formAction] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" value={email} readOnly disabled />
      </Field>

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
    </form>
  );
}
