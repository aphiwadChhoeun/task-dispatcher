"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invitations, sessions, taskers, users } from "@/lib/db/schema";
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
  await db.delete(invitations).where(eq(invitations.userId, userId));
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
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, session.orgId), eq(users.email, parsed.data.email)))
      .get();
    if (existing) throw new ConflictError("A user with that email already exists");

    const userId = crypto.randomUUID();
    const now = new Date();
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
      db.insert(taskers).values({
        userId,
        orgId: session.orgId,
        skills: parseSkills(parsed.data.skills),
        vehicle: parsed.data.vehicle ?? null,
        availability: parsed.data.availability ?? null,
        color: parsed.data.color,
        createdAt: now,
      }),
    ]);

    const url = await createInvite(userId, session.orgId, session.user.id);
    await sendEmail({
      to: parsed.data.email,
      subject: "You are invited to Task Dispatcher",
      text: `Hi ${parsed.data.name},\n\nYour dispatcher invited you to Task Dispatcher. Set your password here: ${url}\n\nThis link expires in ${config.auth.inviteTtlDays} days.`,
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
      success: `${parsed.data.name} was invited. Share the invite link so they can set a password.`,
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
      .from(users)
      .where(
        and(
          eq(users.id, parsed.data.taskerId),
          eq(users.orgId, session.orgId),
          eq(users.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");

    const emailOwner = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, session.orgId), eq(users.email, parsed.data.email)))
      .get();
    if (emailOwner && emailOwner.id !== tasker.id) {
      throw new ConflictError("Another user already uses that email");
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
        .where(eq(taskers.userId, tasker.id)),
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
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, parsed.data.taskerId),
          eq(users.orgId, session.orgId),
          eq(users.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");

    await db
      .update(users)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(users.id, tasker.id));

    if (parsed.data.status === "deactivated") {
      await db.delete(sessions).where(eq(sessions.userId, tasker.id));
    }

    await recordAudit(db, {
      orgId: session.orgId,
      actorId: session.user.id,
      action: `tasker.${parsed.data.status === "active" ? "reactivated" : "deactivated"}`,
      entity: "user",
      entityId: tasker.id,
    });

    revalidatePath("/taskers");
    revalidatePath(`/taskers/${tasker.id}`);
    return {
      success:
        parsed.data.status === "active"
          ? `${tasker.name} can sign in again.`
          : `${tasker.name} was deactivated and signed out.`,
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
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, parsed.data.taskerId),
          eq(users.orgId, session.orgId),
          eq(users.role, "tasker"),
        ),
      )
      .get();
    if (!tasker) throw new NotFoundError("Tasker not found");
    if (tasker.status !== "invited") {
      return { error: "Only a pending invitation can be regenerated." };
    }

    const url = await createInvite(tasker.id, session.orgId, session.user.id);
    await sendEmail({
      to: tasker.email,
      subject: "Your new Task Dispatcher invite link",
      text: `Hi ${tasker.name},\n\nHere is a fresh invite link: ${url}\n\nThis link expires in ${config.auth.inviteTtlDays} days.`,
    });
    revalidatePath("/taskers");
    return { success: "New invite link generated. The previous link no longer works.", inviteUrl: url };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "taskers.resendInvite" });
    return { error: "Could not create a new invite link." };
  }
}
