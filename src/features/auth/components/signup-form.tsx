"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signupAction, type AuthFormState } from "@/features/auth/actions";

const initialState: AuthFormState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field
        label="Organization name"
        htmlFor="organization-name"
        hint="Your team gets its own workspace. You can invite taskers after this step."
        error={state.fieldErrors?.organizationName}
        required
      >
        <Input
          id="organization-name"
          name="organizationName"
          autoComplete="organization"
          placeholder="Acme Field Services"
          required
          minLength={2}
          aria-invalid={Boolean(state.fieldErrors?.organizationName)}
        />
      </Field>

      <Field
        label="Your name"
        htmlFor="signup-name"
        error={state.fieldErrors?.name}
        required
      >
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          placeholder="Dana Reyes"
          required
          minLength={2}
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <Field
        label="Work email"
        htmlFor="signup-email"
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="signup-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="you@company.com"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Password"
          htmlFor="signup-password"
          hint="At least 10 characters."
          error={state.fieldErrors?.password}
          required
        >
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="signup-confirm"
          error={state.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="signup-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
        </Field>
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating workspace…">
        <Building2 className="size-4" aria-hidden />
        Create organization
      </SubmitButton>

      <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
        You will be the first dispatcher for this organization. Taskers join only by invitation.
      </p>
    </form>
  );
}
