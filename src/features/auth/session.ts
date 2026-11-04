import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { getAuthSecret } from "@/lib/server-env";
import { config } from "@/config";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan, type PermissionAction, type Role } from "@/lib/permissions";
import {
  createSessionToken,
  newSessionId,
  sha256Hex,
  verifySessionToken,
} from "./session-token";

export type SessionContext = {
  user: User;
  orgId: string;
};

const SESSION_TTL_SECONDS = config.auth.sessionTtlDays * 24 * 60 * 60;

export function homeForRole(role: Role): string {
  return role === "tasker" ? "/my-tasks" : "/dashboard";
}

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  // Only allow same-origin absolute paths.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

async function isSecureRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto");
    if (proto) return proto.split(",")[0].trim() === "https";
    return new URL(config.app.origin).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export async function createSession(user: User, userAgent?: string | null): Promise<void> {
  const db = getDb();
  const sid = newSessionId();
  const id = await sha256Hex(sid);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    id,
    userId: user.id,
    orgId: user.orgId,
    expiresAt,
    userAgent: userAgent?.slice(0, 300) ?? null,
  });

  // Opportunistic cleanup; keeps the table small without a cron job.
  if (Math.random() < 0.1) {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).catch(() => undefined);
  }

  const token = await createSessionToken(
    { sid, sub: user.id, org: user.orgId, role: user.role, name: user.name },
    getAuthSecret(),
    SESSION_TTL_SECONDS,
  );

  const store = await cookies();
  store.set(config.auth.cookieName, token, {
    httpOnly: true,
    secure: await isSecureRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

async function resolveSession(token: string | null | undefined): Promise<SessionContext | null> {
  if (!token) return null;
  const payload = await verifySessionToken(token, getAuthSecret());
  if (!payload) return null;
  const id = await sha256Hex(payload.sid);
  const db = getDb();
  const row = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .get();

  if (!row) return null;
  if (row.user.status !== "active") return null;
  if (row.user.orgId !== payload.org) return null;
  return { user: row.user, orgId: row.user.orgId };
}

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const store = await cookies();
  return resolveSession(store.get(config.auth.cookieName)?.value);
});

export async function requireUser(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login?reason=session");
  return session;
}

export async function requireDispatcher(): Promise<SessionContext> {
  const session = await requireUser();
  if (session.user.role === "tasker") redirect("/my-tasks");
  return session;
}

export async function requireTasker(): Promise<SessionContext> {
  const session = await requireUser();
  if (session.user.role !== "tasker") redirect("/dashboard");
  return session;
}

export async function requirePermission(action: PermissionAction): Promise<SessionContext> {
  const session = await requireUser();
  assertCan(session.user.role, action);
  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(config.auth.cookieName)?.value;
  if (token) {
    const payload = await verifySessionToken(token, getAuthSecret());
    if (payload) {
      const id = await sha256Hex(payload.sid);
      await getDb().delete(sessions).where(eq(sessions.id, id));
    }
  }
  store.delete(config.auth.cookieName);
}

/** For route handlers that receive a raw Request. */
export async function getSessionFromRequest(request: Request): Promise<SessionContext | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${config.auth.cookieName}=`));
  const token = cookie ? decodeURIComponent(cookie.slice(config.auth.cookieName.length + 1)) : null;
  return resolveSession(token);
}

export async function requireApiSession(request: Request): Promise<SessionContext> {
  const session = await getSessionFromRequest(request);
  if (!session) throw new UnauthorizedError();
  return session;
}
