"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invitations, memberships, sessions, taskers, users } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { reportError } from "@/lib/observability";
import { requirePermission } from "@/features/auth/session";
import { newInvitationToken, sha256Hex } from "@/features/auth/session-token";
import { recordAudit } from "@/features/audit/log";
import { sendEmail } from "@/features/email/service";
import { config } from "@/config";
import {
  resendInviteSchema,
  taskerCreateSchema,
  taskerStatusSchema,
  taskerUpdateSchema,
} from "./schemas";

export type TaskerFormState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
  fieldErrors?: Record<string, string>;
};

async function inviteUrl(token: string): Promise<string> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";
    if (host) return `${proto}://${host}/invite/${token}`;
  } catch {
    // fall through to the configured origin
  }
  return `${config.app.origin.replace(/\/$/, "")}/invite/${token}`;
}

async function createInvite(userId: string, orgId: string, createdBy: string) {
  const db = getDb();
  const raw = newInvitationToken();
  const id = await sha256Hex(raw);
  const expiresAt = new Date(Date.now() + config.auth.inviteTtlDays * 24 * 60 * 60 * 1000);
  await db
    .delete(invitations)
    .where(and(eq(invitations.userId, userId), eq(invitations.orgId, orgId)));
  await db.insert(invitations).values({
    id,
    orgId,
    userId,
    createdBy,
    expiresAt,
  });
  return inviteUrl(raw);
}

function parseSkills(skills: string | undefined): string | null {
  if (!skills) return null;
  return JSON.stringify(
    skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  );
}

export async function createTaskerAction(
  _prev: TaskerFormState,
  formData: FormData,
): Promise<TaskerFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("taskers.manage");
    const parsed = taskerCreateSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      skills: formData.get("skills") || undefined,
      vehicle: formData.get("vehicle") || undefined,
      availability: formData.get("availability") || undefined,
      color: formData.get("color") || "#0f766e",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form" };
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .get();

    if (existing) {
      const existingMembership = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(eq(memberships.orgId, session.orgId), eq(memberships.userId, existing.id)),
        )
        .get();
      if (existingMembership) {
        throw new ConflictError("That person is already a member of this organization.");
      }

      const dispatcherMembership = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, existing.id),
            inArray(memberships.role, ["dispatcher", "admin"]),
          ),
        )
        .get();
      if (dispatcherMembership) {
        throw new ConflictError(
          "That email belongs to a dispatcher account. Dispatchers can only belong to one organization.",
        );
      }
      if (existing.status === "deactivated") {
        throw new ConflictError("That account has been deactivated.");
      }
    }

    const userId = existing?.id ?? crypto.randomUUID();
    const displayName = existing?.name ?? parsed.data.name;
    const now = new Date();
    const membershipId = crypto.randomUUID();
    const membershipValues = {
      id: membershipId,
      orgId: session.orgId,
      userId,
      role: "tasker" as const,
      status: "invited" as const,
      createdAt: now,
      updatedAt: now,
    };
    const taskerValues = {
      userId,
      orgId: session.orgId,
      skills: parseSkills(parsed.data.skills),
      vehicle: parsed.data.vehicle ?? null,
      availability: parsed.data.availability ?? null,
      color: parsed.data.color,
      createdAt: now,
    };

    if (existing) {
      await db.batch([
        db.insert(memberships).values(membershipValues),
        db.insert(taskers).values(taskerValues),
      ]);
    } else {
      await db.batch([
        db.insert(users).values({
          id: userId,
          orgId: session.orgId,
          role: "tasker",
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          passwordHash: null,
          status: "invited",
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(memberships).values(membershipValues),
        db.insert(taskers).values(taskerValues),
      ]);
    }

    const url = await createInvite(userId, session.orgId, session.user.id);
    await sendEmail({
      to: parsed.data.email,
      subject: `You are invited to ${session.organization.name} on Task Dispatcher`,
      text: `Hi ${displayName},\n\n${session.user.name} invited you to join ${session.organization.name} on Task Dispatcher. ${existing ? "Accept the invitation to add this organization to your existing account" : "Set your password"} here: ${url}\n\nThis link expires in ${config.auth.inviteTtlDays} days.`,
    });

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "tasker.invited",
      entity: "user",
      entityId: userId,
      metadata: { email: parsed.data.email },
    });

    revalidatePath("/taskers");
    return {
      success: `${displayName} was invited. Share the invite link so they can join ${session.organization.name}.`,
      inviteUrl: url,
    };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "taskers.create" });
    return { error: "Could not invite the tasker." };
  }
}

export async function updateTaskerAction(
  _prev: TaskerFormState,
  formData: FormData,
): Promise<TaskerFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("taskers.manage");
    const parsed = taskerUpdateSchema.safeParse({
      taskerId: formData.get("taskerId"),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      skills: formData.get("skills") || undefined,
      vehicle: formData.get("vehicle") || undefined,
      availability: formData.get("availability") || undefined,
      color: formData.get("color") || "#0f766e",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

    const db = getDb();
    const tasker = await db
      .select({ id: users.id })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.userId, parsed.data.taskerId),
          eq(memberships.orgId, session.orgId),
          eq(memberships.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");

    const emailOwner = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .get();
    if (emailOwner && emailOwner.id !== tasker.id) {
      throw new ConflictError("Another account already uses that email");
    }

    await db.batch([
      db
        .update(users)
        .set({
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, tasker.id)),
      db
        .update(taskers)
        .set({
          skills: parseSkills(parsed.data.skills),
          vehicle: parsed.data.vehicle ?? null,
          availability: parsed.data.availability ?? null,
          color: parsed.data.color,
        })
        .where(and(eq(taskers.userId, tasker.id), eq(taskers.orgId, session.orgId))),
    ]);

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "tasker.updated",
      entity: "user",
      entityId: tasker.id,
    });

    revalidatePath("/taskers");
    revalidatePath(`/taskers/${tasker.id}`);
    return { success: "Tasker profile updated" };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "taskers.update" });
    return { error: "Could not update the tasker." };
  }
}

export async function setTaskerStatusAction(
  _prev: TaskerFormState,
  formData: FormData,
): Promise<TaskerFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("taskers.manage");
    const parsed = taskerStatusSchema.safeParse({
      taskerId: formData.get("taskerId"),
      status: formData.get("status"),
    });
    if (!parsed.success) return { error: "Invalid request" };

    const db = getDb();
    const tasker = await db
      .select({ membership: memberships, user: users })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.userId, parsed.data.taskerId),
          eq(memberships.orgId, session.orgId),
          eq(memberships.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");

    await db
      .update(memberships)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(memberships.id, tasker.membership.id));

    if (parsed.data.status === "deactivated") {
      await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, tasker.user.id),
            eq(sessions.orgId, session.orgId),
          ),
        );
    }

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: `tasker.${parsed.data.status === "active" ? "reactivated" : "deactivated"}`,
      entity: "membership",
      entityId: tasker.membership.id,
      metadata: { userId: tasker.user.id },
    });

    revalidatePath("/taskers");
    revalidatePath(`/taskers/${tasker.user.id}`);
    return {
      success:
        parsed.data.status === "active"
          ? `${tasker.user.name} can sign in to this organization again.`
          : `${tasker.user.name} was deactivated for this organization.`,
    };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "taskers.status" });
    return { error: "Could not update the tasker status." };
  }
}

export async function resendTaskerInviteAction(
  _prev: TaskerFormState,
  formData: FormData,
): Promise<TaskerFormState> {
  try {
    await assertSameOrigin();
    const session = await requirePermission("taskers.manage");
    const parsed = resendInviteSchema.safeParse({
      taskerId: formData.get("taskerId"),
    });
    if (!parsed.success) return { error: "Invalid request" };

    const db = getDb();
    const tasker = await db
      .select({ membership: memberships, user: users })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.userId, parsed.data.taskerId),
          eq(memberships.orgId, session.orgId),
          eq(memberships.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");
    if (tasker.membership.status !== "invited") {
      return { error: "Only a pending invitation can be regenerated." };
    }

    const url = await createInvite(tasker.user.id, session.orgId, session.user.id);
    await sendEmail({
      to: tasker.user.email,
      subject: `Your new ${session.organization.name} invite link`,
      text: `Hi ${tasker.user.name},\n\nHere is a fresh invite to join ${session.organization.name} on Task Dispatcher: ${url}\n\nThis link expires in ${config.auth.inviteTtlDays} days.`,
    });
    revalidatePath("/taskers");
    return { success: "New invite link generated. The previous link no longer works.", inviteUrl: url };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "taskers.resendInvite" });
    return { error: "Could not create a new invite link." };
  }
}
