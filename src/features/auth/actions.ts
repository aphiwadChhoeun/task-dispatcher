"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { invitations, users } from "@/lib/db/schema";
import { emailSchema, flattenZodError, passwordSchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { clientIp, recordLoginAttempt, assertLoginAllowed } from "@/lib/rate-limit";
import { AppError, RateLimitError } from "@/lib/errors";
import { log, reportError } from "@/lib/observability";
import { verifyPassword, hashPassword } from "./password";
import { findInvitation, findUserByEmail, findUserById } from "./queries";
import {
  createSession,
  destroySession,
  homeForRole,
  safeNextPath,
} from "./session";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let redirectTo = "/";

  try {
    await assertSameOrigin();
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next") || undefined,
    });

    if (!parsed.success) {
      return { fieldErrors: flattenZodError(parsed.error) };
    }

    const db = getDb();
    const headerStore = await headers();
    const ip = await clientIp(headerStore);
    await assertLoginAllowed(db, parsed.data.email, ip);

    const user = await findUserByEmail(parsed.data.email);
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

    await recordLoginAttempt(db, parsed.data.email, ip, valid);

    if (!user || !valid) {
      return { error: "Email or password is incorrect" };
    }
    if (user.status === "deactivated") {
      return { error: "This account has been deactivated. Contact your dispatcher." };
    }
    if (user.status === "invited") {
      return { error: "This account is pending an invitation. Open the invite link to activate it." };
    }

    await createSession(user, headerStore.get("user-agent"));
    log("info", "user signed in", { userId: user.id, role: user.role });

    redirectTo = safeNextPath(parsed.data.next) ?? homeForRole(user.role);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    if (error instanceof AppError) {
      return { error: error.message };
    }
    reportError(error, { scope: "auth.login" });
    return { error: "Something went wrong. Please try again." };
  }

  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  try {
    await assertSameOrigin();
  } catch {
    // Still clear the session on logout even if the origin header is odd.
  }
  await destroySession();
  redirect("/login");
}

const inviteSchema = z
  .object({
    token: z.string().min(20),
    name: z.string().trim().min(2, "Enter your name").max(120),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function acceptInviteAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let redirectTo = "/my-tasks";

  try {
    await assertSameOrigin();
    const parsed = inviteSchema.safeParse({
      token: formData.get("token"),
      name: formData.get("name"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      return { fieldErrors: flattenZodError(parsed.error) };
    }

    const details = await findInvitation(parsed.data.token);
    if (!details) {
      return { error: "This invitation is invalid or has expired. Ask your dispatcher for a new one." };
    }
    if (details.user.status !== "invited") {
      return { error: "This invitation has already been used. Sign in instead." };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const db = getDb();
    const now = new Date();
    await db
      .update(users)
      .set({
        name: parsed.data.name,
        passwordHash,
        status: "active",
        updatedAt: now,
      })
      .where(and(eq(users.id, details.user.id), eq(users.status, "invited")));

    await db
      .update(invitations)
      .set({ acceptedAt: now })
      .where(eq(invitations.id, details.invitationId));

    // The invitation token is single-use; remove any duplicates for this user.
    await db.delete(invitations).where(eq(invitations.userId, details.user.id));

    const updated = await findUserById(details.user.id);
    if (!updated) return { error: "Account not found" };

    const headerStore = await headers();
    await createSession(updated, headerStore.get("user-agent"));
    log("info", "invitation accepted", { userId: updated.id });
    redirectTo = "/my-tasks";
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "auth.invite" });
    return { error: "Something went wrong. Please try again." };
  }

  redirect(redirectTo);
}
