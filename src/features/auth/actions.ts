"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { invitations, memberships, organizations, users } from "@/lib/db/schema";
import { emailSchema, flattenZodError } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { clientIp, recordLoginAttempt, assertLoginAllowed } from "@/lib/rate-limit";
import { AppError, RateLimitError } from "@/lib/errors";
import { log, reportError } from "@/lib/observability";
import { recordAudit } from "@/features/audit/log";
import { uniqueOrganizationSlug } from "@/features/organizations/slug";
import { verifyPassword, hashPassword } from "./password";
import {
  findInvitation,
  findUserByEmail,
  findUserById,
  listActiveMembershipsForUser,
} from "./queries";
import { acceptInviteSchema, acceptInviteTokenSchema, signupSchema } from "./schemas";
import {
  clearOrgSelectChallenge,
  createOrgSelectChallenge,
  createSession,
  destroySession,
  getSession,
  homeForRole,
  safeNextPath,
} from "./session";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  successMessage?: string;
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

    const activeMemberships = await listActiveMembershipsForUser(user.id);
    if (activeMemberships.length === 0) {
      return { error: "This account has no active organization. Contact your dispatcher." };
    }

    if (activeMemberships.length > 1) {
      await createOrgSelectChallenge(user.id);
      log("info", "user signed in; choosing organization", { userId: user.id });
      redirectTo = "/select-organization";
    } else {
      const membership = activeMemberships[0].membership;
      await createSession(user, membership, headerStore.get("user-agent"));
      log("info", "user signed in", { userId: user.id, orgId: membership.orgId });
      redirectTo =
        safeNextPath(parsed.data.next) ?? homeForRole(membership.role);
    }
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

function isUniqueConstraintError(error: unknown, column: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint failed/i.test(message) && message.toLowerCase().includes(column);
}

/**
 * Self-serve organization onboarding. Creates an isolated tenant and its first
 * dispatcher, then signs that dispatcher in. Emails are globally unique because
 * email is the only login identifier.
 */
export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let redirectTo = "/dashboard";

  try {
    await assertSameOrigin();
    const parsed = signupSchema.safeParse({
      organizationName: formData.get("organizationName"),
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return { fieldErrors: flattenZodError(parsed.error) };
    }

    const db = getDb();
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return {
        fieldErrors: {
          email: "An account with this email already exists. Sign in instead.",
        },
      };
    }

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const now = new Date();
    const [slug, passwordHash] = await Promise.all([
      uniqueOrganizationSlug(db, parsed.data.organizationName),
      hashPassword(parsed.data.password),
    ]);

    await db.batch([
      db.insert(organizations).values({
        id: orgId,
        name: parsed.data.organizationName,
        slug,
        createdAt: now,
      }),
      db.insert(users).values({
        id: userId,
        orgId,
        role: "dispatcher",
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(memberships).values({
        id: membershipId,
        orgId,
        userId,
        role: "dispatcher",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    ]);

    await recordAudit(db, {
      orgId,
      actorId: userId,
      action: "organization.created",
      entity: "organization",
      entityId: orgId,
      metadata: { name: parsed.data.organizationName, slug },
    }).catch((error) => reportError(error, { scope: "auth.signup.audit" }));

    const user = await findUserById(userId);
    if (!user) return { error: "Could not finish creating your organization." };

    const headerStore = await headers();
    await createSession(
      user,
      {
        id: membershipId,
        orgId,
        userId,
        role: "dispatcher",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      headerStore.get("user-agent"),
    );
    log("info", "organization signed up", { orgId, userId });

    redirectTo = "/dashboard?welcome=1";
  } catch (error) {
    if (isUniqueConstraintError(error, "users.email")) {
      return {
        fieldErrors: {
          email: "An account with this email already exists. Sign in instead.",
        },
      };
    }
    if (isUniqueConstraintError(error, "organizations.slug")) {
      return { error: "That organization name is already in use. Try another name." };
    }
    if (error instanceof AppError) {
      return { error: error.message };
    }
    reportError(error, { scope: "auth.signup" });
    return { error: "Could not create your organization. Please try again." };
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
  await clearOrgSelectChallenge();
  redirect("/login");
}

export async function acceptInviteAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let redirectTo: string | null = null;
  let successMessage: string | undefined;

  try {
    await assertSameOrigin();
    const tokenParsed = acceptInviteTokenSchema.safeParse({
      token: formData.get("token"),
    });
    if (!tokenParsed.success) {
      return { fieldErrors: flattenZodError(tokenParsed.error) };
    }

    const details = await findInvitation(tokenParsed.data.token);
    if (!details) {
      return { error: "This invitation is invalid or has expired. Ask your dispatcher for a new one." };
    }
    if (details.membership.status !== "invited") {
      return { error: "This invitation has already been used. Sign in instead." };
    }
    if (details.user.status === "deactivated") {
      return { error: "This account has been deactivated. Contact your dispatcher." };
    }

    const db = getDb();
    const now = new Date();
    const existingAccount = Boolean(details.user.passwordHash);

    if (existingAccount) {
      // An existing tasker account can be linked to another organization
      // without changing its password or profile.
      await db.batch([
        db
          .update(memberships)
          .set({ status: "active", updatedAt: now })
          .where(
            and(
              eq(memberships.id, details.membership.id),
              eq(memberships.status, "invited"),
            ),
          ),
        db
          .update(invitations)
          .set({ acceptedAt: now })
          .where(eq(invitations.id, details.invitationId)),
      ]);
    } else {
      const parsed = acceptInviteSchema.safeParse({
        token: formData.get("token"),
        name: formData.get("name"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
      });
      if (!parsed.success) {
        return { fieldErrors: flattenZodError(parsed.error) };
      }

      const passwordHash = await hashPassword(parsed.data.password);
      await db.batch([
        db
          .update(users)
          .set({
            name: parsed.data.name,
            passwordHash,
            status: "active",
            updatedAt: now,
          })
          .where(eq(users.id, details.user.id)),
        db
          .update(memberships)
          .set({ status: "active", updatedAt: now })
          .where(
            and(
              eq(memberships.id, details.membership.id),
              eq(memberships.status, "invited"),
            ),
          ),
        db
          .update(invitations)
          .set({ acceptedAt: now })
          .where(eq(invitations.id, details.invitationId)),
      ]);
    }

    // Invitations are single-use per user + organization; one user can still
    // have pending invitations from other organizations.
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.userId, details.user.id),
          eq(invitations.orgId, details.orgId),
        ),
      );

    const updatedUser = await findUserById(details.user.id);
    const updatedMembership = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, details.membership.id))
      .get();
    if (!updatedUser || !updatedMembership) return { error: "Account not found" };

    if (existingAccount) {
      const current = await getSession();
      if (current?.user.id === updatedUser.id) {
        const headerStore = await headers();
        await destroySession();
        await createSession(updatedUser, updatedMembership, headerStore.get("user-agent"));
        log("info", "invitation accepted; switched organization", {
          userId: updatedUser.id,
          orgId: details.orgId,
        });
        redirectTo = homeForRole(updatedMembership.role);
      } else {
        successMessage = `Invitation accepted for ${updatedUser.email}. Sign in with that account to open ${details.organizationName}.`;
      }
    } else {
      const headerStore = await headers();
      await createSession(updatedUser, updatedMembership, headerStore.get("user-agent"));
      log("info", "invitation accepted", { userId: updatedUser.id, orgId: details.orgId });
      redirectTo = homeForRole(updatedMembership.role);
    }
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "auth.invite" });
    return { error: "Something went wrong. Please try again." };
  }

  if (redirectTo) redirect(redirectTo);
  return { successMessage };
}
